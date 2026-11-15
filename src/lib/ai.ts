import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// One place that talks to a model. AI_PROVIDER=gemini (default, free tier) or anthropic.
// light: use the cheaper model (checker, WhatsApp copy) to stay inside free-tier daily quotas.
export async function generateJson<S extends z.ZodType>(schema: S, system: string, user: string, opts: { light?: boolean } = {}): Promise<z.infer<S>> {
  return (process.env.AI_PROVIDER ?? "gemini") === "anthropic" ? viaClaude(schema, system, user) : viaGemini(schema, system, user, opts);
}

async function viaGemini<S extends z.ZodType>(schema: S, system: string, user: string, opts: { light?: boolean }): Promise<z.infer<S>> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  // SDK retries off (they silently wait out long quota delays); this loop decides instead.
  const ai = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 120_000, retryOptions: { attempts: 1 } } });
  const primary = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";
  let model = opts.light ? fallback : primary;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: user,
        config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema) },
      });
      if (!res.text) throw new Error(`Gemini returned no text (finish: ${res.candidates?.[0]?.finishReason ?? "unknown"})`);
      return schema.parse(JSON.parse(res.text));
    } catch (e) {
      // 429 = free quota used up (often for the day): switch model now. 5xx = busy or slow: wait, then switch.
      const status = (e as { status?: number }).status;
      if (attempt >= 4 || ![429, 500, 503, 504].includes(status ?? 0)) throw e;
      if (status === 429 && model !== fallback) { model = fallback; continue; }
      await new Promise((r) => setTimeout(r, 10_000 * attempt));
      if (attempt >= 2) model = fallback;
    }
  }
}

async function viaClaude<S extends z.ZodType>(schema: S, system: string, user: string): Promise<z.infer<S>> {
  const res = await new Anthropic().beta.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal" || res.parsed_output == null) throw new Error(`Claude gave no usable output (stop: ${res.stop_reason})`);
  return res.parsed_output as z.infer<S>;
}
