import { z } from "zod";
import { generateJson } from "./ai.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LIMITS } from "./plan.ts";
import type { NewPost } from "./posts.ts";

export const readFacts = () => readFileSync(join(process.cwd(), "content", "facts.md"), "utf8");

export type CheckResult = { pass: boolean; violations: string[] };

// Plain-code guardrails. These run first, cost nothing, and are the hard floor.
const RULES: [RegExp, string][] = [
  [/\b(double|triple|10x|boost)\s+(your\s+)?(profits?|income|earnings)|\bguarantee[sd]?\b.*\b(profits?|income|returns?)\b|\bearn\s+(more|\$|ugx|usd)|\bget rich\b|\bmake money\b|\bprofit of\s+\$?\d/i, "income promise"],
  [/\b\d[\d,.]*\s*(k|m|\+)?\s*\+?\s*(farmers|users|downloads|installs|customers|people|members)\b|\b(thousands|hundreds|millions)\s+of\s+(farmers|users|people)\b/i, "user or download count"],
  [/["“][^"”]{8,}["”]\s*[-—–]\s*\p{Lu}|\b(says|said|told us)\b[^.]{0,40}\bfarmer\b|\bfarmer\s+\p{Lu}\p{Ll}+\s+(says|said|from)\b|\btestimonial\b|\b\d+%\s+(fewer|less|more|lower|higher)\b/iu, "testimonial or result claim"],
  [/\bcures?\b|\bdiagnos\w*|\bwill\s+(treat|heal|prevent|stop)\b|\bno more (deaths|disease|losses)\b|\bguarantee[sd]?\s+(healthy|survival)/i, "disease diagnosis or treatment claim"],
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
  if (!/\b(install|download|get|visit|learn|book|shop|watch|follow|order)\b/i.test(p.caption)) v.push("caption missing a clear call to action");

  try {
    const link = new URL(p.install_link);
    if (link.protocol !== "https:" || link.searchParams.get("utm_source") !== p.channel)
      v.push("destination link missing or not tagged for this channel");
  } catch {
    v.push("destination link is not a valid https URL");
  }
  return { pass: v.length === 0, violations: v };
}

const Verdict = z.object({
  pass: z.boolean(),
  violations: z.array(z.string()).describe("One short line per broken rule or premium-quality failure; empty when pass is true"),
  qualityScore: z.number().min(0).max(10).describe("0-10 score for hook power, specific value, channel fit, visual clarity and retention"),
});

const CHECKLIST = `You review one social media post for a specific business. Fail the post if ANY rule is broken:
1. States as fact anything not in FACTS (features, prices, free vs Pro, claims).
2. Invents testimonials, customer names, user counts, results, awards, features, prices or offers.
3. Makes a medical, legal, financial, safety, or guaranteed outcome without verified support in FACTS.
4. Uses false urgency, fake scarcity, manipulative claims, deceptive clicks, or hidden engagement tactics.
5. Mentions a feature, plan, price, or availability not supported by FACTS.
6. Copies competitor content, uses unlicensed assets, or relies on copyrighted or trending audio.
7. Does not end with one clear call to action for the business.
8. The hook is generic, vague, weak, or interchangeable with competitor copy.
9. The post gives no specific useful payoff, or the caption repeats the visual without adding value.
10. The visual text, carousel sequence, or video beats are cluttered, confusing, or fail to build retention.
11. The hook, visual and caption do not fit the selected channel and format.
Pass only when the premium quality score is at least 8.0 out of 10.
Be strict: when unsure, fail it and say why.`;

export async function llmCheck(p: NewPost, facts = readFacts()): Promise<CheckResult> {
  const v = await generateJson(
    Verdict,
    `${CHECKLIST}\n\n<facts>\n${facts}\n</facts>`,
    `Channel: ${p.channel}\nPillar: ${p.pillar}\nFormat: ${p.format}\n\n<post>\n${JSON.stringify({ hook: p.hook, caption: p.caption, hashtags: p.hashtags, visual: p.visual }, null, 2)}\n</post>`,
    { light: true },
  );
  // Fail closed: "pass" with listed violations is treated as a fail.
  const pass = v.pass && v.violations.length === 0 && v.qualityScore >= 8;
  const violations = v.violations.length
    ? v.violations
    : [v.qualityScore < 8 ? `premium quality score ${v.qualityScore}/10 is below 8.0` : "checker failed the post without a reason"];
  return { pass, violations: pass ? [] : violations };
}

export async function checkPost(p: NewPost, facts = readFacts()): Promise<CheckResult> {
  const code = codeCheck(p, facts);
  if (!code.pass) return code;
  return llmCheck(p, facts);
}
