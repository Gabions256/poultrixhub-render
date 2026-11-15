import { z } from "zod";
import { generateJson } from "./ai.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "./db.ts";
import { checkPost, readFacts, type CheckResult } from "./checker.ts";
import { LIMITS, installLink, planDay, type Slot } from "./plan.ts";
import { CHANNELS, insertPost, type Channel, type NewPost, type Pillar, type Post } from "./posts.ts";

export type Brief = { id?: number; stage: string; push: string };

const PILLAR_TEXT: Record<Pillar, string> = {
  farm_tip: "Farm tip: one practical tip for broiler, layer or local chicken farmers.",
  calculator_demo: "Calculator demo: a free calculator in the app solving a real question, such as feed cost or break-even price.",
  problem_fix: "Problem and fix: a common loss (mortality, missed vaccines, lost records) and the app feature that handles it.",
  app_walkthrough: "App walkthrough: 20 to 30 seconds of one app screen doing one job.",
  install_ask: "Direct install ask: what is free, and the link.",
};

const Draft = z.object({
  hook: z.string().describe("First line that stops the scroll, under 100 characters"),
  caption: z.string().describe("Full caption. Ends with one call to action to install PoultrixHub. No URL and no hashtags in the caption; hashtags go in the hashtags field."),
  hashtags: z.array(z.string()).describe("Hashtags with the # sign"),
  visual: z.object({
    headline: z.string().describe("Big text on the card or first slide, under 8 words"),
    body: z.string().describe("Supporting line on the card, under 25 words"),
    slides: z.array(z.string()).describe("Carousel: 3 to 5 slide texts. Video: 3 to 5 on-screen text beats. Image: empty"),
  }),
});
const Drafts = z.object({ posts: z.array(Draft) });

const RULES = `You write social posts for PoultrixHub, an Android app for poultry farmers (broiler, layer, local chicken).
Every post belongs to the pillar it is given, uses the format it is given, and ends with one call to action: install PoultrixHub.
Language: plain English for farmers in East Africa. Prices in USD only, and only prices that appear in FACTS.
Never: invent testimonials, farmer names, user counts or results; diagnose disease or claim the app treats it (health posts point to the app and a vet); promise income; mention features not in FACTS; call a feature free unless FACTS says so; copy competitors; suggest trending audio.
Anything not in FACTS cannot be stated as fact.`;

// Models sometimes repeat hashtags at the end of the caption; they are published from the hashtags field.
export const stripTrailingHashtags = (c: string) => c.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, "").trim();

const prompt = (channel: Channel) => readFileSync(join(process.cwd(), "content", "prompts", `${channel}.md`), "utf8");

export async function writeChannel(
  brief: Brief, channel: Channel, slots: Slot[], winners: string[], feedback?: string,
): Promise<NewPost[]> {
  const lim = LIMITS[channel];
  const { posts } = await generateJson(
    Drafts,
    `${RULES}

<channel_rules>
${prompt(channel)}
</channel_rules>

<facts>
${readFacts()}
</facts>`,
    [
      `Brief. Stage of the business: ${brief.stage}. Today's push: ${brief.push}.`,
      winners.length ? `Last week's best posts (learn from their hooks and formats):\n- ${winners.join("\n- ")}` : "No winners yet.",
      `Write exactly ${slots.length} ${channel} post(s), in this order:`,
      ...slots.map((s, i) => `${i + 1}. Pillar: ${PILLAR_TEXT[s.pillar]} Format: ${s.format}.`),
      `Limits: caption at most ${lim.caption} characters, at most ${lim.hashtags} hashtags.`,
      feedback ? `A previous draft failed review for these reasons. Fix every one:\n${feedback}` : "",
    ].join("\n\n"),
  );
  if (posts.length !== slots.length) throw new Error(`writer returned ${posts.length} posts for ${channel}, wanted ${slots.length}`);
  return posts.map((d, i) => ({
    brief_id: brief.id ?? null,
    channel,
    pillar: slots[i].pillar,
    format: slots[i].format,
    hook: d.hook,
    caption: stripTrailingHashtags(d.caption),
    hashtags: d.hashtags,
    install_link: installLink(channel),
    visual: d.visual,
  }));
}

/** Brief -> 6 checked drafts. A failing post is rewritten once, then dropped. */
export async function generatePosts(
  brief: Brief, opts: { history?: Partial<Record<Pillar, number>>; winners?: string[] } = {},
): Promise<{ kept: NewPost[]; dropped: { post: NewPost; check: CheckResult }[] }> {
  const slots = planDay(opts.history);
  const kept: NewPost[] = [];
  const dropped: { post: NewPost; check: CheckResult }[] = [];
  await Promise.all(CHANNELS.map(async (channel) => {
    const mine = slots.filter((s) => s.channel === channel);
    const drafts = await writeChannel(brief, channel, mine, opts.winners ?? []);
    for (const [i, post] of drafts.entries()) {
      let check = await checkPost(post);
      if (check.pass) { kept.push(post); continue; }
      const [retry] = await writeChannel(brief, channel, [mine[i]], opts.winners ?? [], check.violations.join("\n"));
      const recheck = await checkPost(retry);
      if (recheck.pass) kept.push({ ...retry, check_notes: `rewritten: ${check.violations.join("; ")}` });
      else { check = recheck; dropped.push({ post: retry, check }); }
    }
  }));
  return { kept, dropped };
}

export async function latestBrief(): Promise<Brief | undefined> {
  const [b] = await sql<Brief[]>`SELECT id, stage, push FROM briefs ORDER BY created_at DESC LIMIT 1`;
  return b;
}

/** Daily job step 2-4: generate, check, and save drafts for the latest brief. */
export async function generateDay(): Promise<{ saved: Post[]; dropped: number }> {
  const brief = await latestBrief();
  if (!brief) throw new Error("No brief yet. Type one in the app first.");
  const hist = await sql<{ pillar: Pillar; n: number }[]>`
    SELECT pillar, count(*)::int AS n FROM posts WHERE created_at > now() - interval '30 days' GROUP BY pillar`;
  const winners = await sql<{ line: string }[]>`
    SELECT p.pillar || ' / ' || p.format || ': ' || p.hook AS line
    FROM posts p JOIN LATERAL (SELECT views FROM metrics m WHERE m.post_id = p.id ORDER BY collected_at DESC LIMIT 1) m ON true
    WHERE p.published_at > now() - interval '7 days' AND m.views IS NOT NULL
    ORDER BY m.views DESC LIMIT 5`;
  const { kept, dropped } = await generatePosts(brief, {
    history: Object.fromEntries(hist.map((h) => [h.pillar, h.n])),
    winners: winners.map((w) => w.line),
  });
  const saved = [];
  for (const p of kept) saved.push(await insertPost(p));
  return { saved, dropped: dropped.length };
}
