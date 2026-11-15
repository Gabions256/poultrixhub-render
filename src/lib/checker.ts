import { z } from "zod";
import { generateJson } from "./ai.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LIMITS, installLink } from "./plan.ts";
import type { NewPost } from "./posts.ts";

export const readFacts = () => readFileSync(join(process.cwd(), "content", "facts.md"), "utf8");

export type CheckResult = { pass: boolean; violations: string[] };

// Plain-code guardrails. These run first, cost nothing, and are the hard floor.
const RULES: [RegExp, string][] = [
  [/\b(double|triple|10x|boost)\s+(your\s+)?(profits?|income|earnings)|\bguarantee[sd]?\b.*\b(profits?|income|returns?)\b|\bearn\s+(more|\$|ugx|usd)|\bget rich\b|\bmake money\b|\bprofit of\s+\$?\d/i, "income promise"],
  [/\b\d[\d,.]*\s*(k|m|\+)?\s*\+?\s*(farmers|users|downloads|installs|customers|people|members)\b|\b(thousands|hundreds|millions)\s+of\s+(farmers|users|people)\b/i, "user or download count"],
  [/["“][^"”]{8,}["”]\s*[-—–]\s*\p{Lu}|\b(says|said|told us)\b[^.]{0,40}\bfarmer\b|\bfarmer\s+\p{Lu}\p{Ll}+\s+(says|said|from)\b|\btestimonial\b|\b\d+%\s+(fewer|less|more|lower|higher)\b/iu, "testimonial or result claim"],
  [/\bcures?\b|\bdiagnos\w*|\bwill\s+(treat|heal|prevent|stop)\b|\bno more (deaths|disease|losses)\b|\bguarantee[sd]?\s+(healthy|survival)/i, "disease diagnosis or treatment claim"],
  [/\b(iphone|ios|app\s*store|apple)\b/i, "platform the app is not on"],
];

export function codeCheck(p: NewPost, facts = readFacts()): CheckResult {
  const v: string[] = [];
  const text = `${p.hook}\n${p.caption}\n${JSON.stringify(p.visual ?? {})}`;
  for (const [re, why] of RULES) if (re.test(text)) v.push(why);

  if (/\bhealth scan\b/i.test(text) && !/\bvet\b/i.test(text)) v.push("health scan mentioned without pointing to a vet");
  for (const price of text.match(/(\$|usd\s?|ugx\s?)\d[\d,.]*/gi) ?? [])
    if (!facts.includes(price.trim())) v.push(`price not in facts.md: ${price}`);

  const lim = LIMITS[p.channel];
  if (p.caption.length > lim.caption) v.push(`caption over ${lim.caption} characters`);
  if (p.hook.length > lim.hook) v.push(`hook over ${lim.hook} characters`);
  if (p.hashtags.length > lim.hashtags) v.push(`more than ${lim.hashtags} hashtags`);
  if (!/poultrix\s?hub/i.test(p.caption) || !/\b(install|download|get)\b/i.test(p.caption)) v.push("caption missing the install call to action");

  if (p.install_link !== installLink(p.channel)) v.push("install link missing or not tagged for this channel");
  return { pass: v.length === 0, violations: v };
}

const Verdict = z.object({
  pass: z.boolean(),
  violations: z.array(z.string()).describe("One short line per broken rule; empty when pass is true"),
});

const CHECKLIST = `You review one social media post for PoultrixHub, a poultry farm app. Fail the post if ANY rule is broken:
1. States as fact anything not in FACTS (features, prices, free vs Pro, claims).
2. Invents testimonials, farmer names, user counts, download numbers or results.
3. Diagnoses disease or claims the app treats, cures or prevents disease. Health topics must point to the app and a vet.
4. Promises income or profit ("double your profit", "earn more").
5. Mentions a feature the app does not have, or presents a Pro feature as free. Until FACTS lists Free vs Pro, only "free to download" may be said.
6. Copies competitor content, or relies on trending audio or images without rights.
7. Does not end with one call to action to install PoultrixHub.
Be strict: when unsure, fail it and say why.`;

export async function llmCheck(p: NewPost, facts = readFacts()): Promise<CheckResult> {
  const v = await generateJson(
    Verdict,
    `${CHECKLIST}\n\n<facts>\n${facts}\n</facts>`,
    `Channel: ${p.channel}\nPillar: ${p.pillar}\nFormat: ${p.format}\n\n<post>\n${JSON.stringify({ hook: p.hook, caption: p.caption, hashtags: p.hashtags, visual: p.visual }, null, 2)}\n</post>`,
    { light: true },
  );
  // Fail closed: "pass" with listed violations is treated as a fail.
  const pass = v.pass && v.violations.length === 0;
  return { pass, violations: pass ? [] : v.violations.length ? v.violations : ["checker failed the post without a reason"] };
}

export async function checkPost(p: NewPost, facts = readFacts()): Promise<CheckResult> {
  const code = codeCheck(p, facts);
  if (!code.pass) return code;
  return llmCheck(p, facts);
}
