import { z } from "zod";
import { generateJson } from "./ai.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "./db.ts";
import { checkPost, readFacts, type CheckResult } from "./checker.ts";
import { LIMITS, installLink, planDay, type Slot } from "./plan.ts";
import { approvePost, ACTIVE_CHANNELS, insertPost, type Channel, type NewPost, type Pillar, type Post } from "./posts.ts";
import { autoApproveEnabled } from "./settings.ts";
import { finishRun, startRun } from "./jobs.ts";

export const CONTENT_MODES = ["balanced", "image", "video"] as const;
export type ContentMode = (typeof CONTENT_MODES)[number];
export type BriefSpec = {
  audience: string;
  objective: string;
  tone: string;
  contentMode: ContentMode;
  visualStyle: string;
  creativeDirection: string;
};
export type Brief = { id?: number; business_id?: number; stage: string; push: string; spec?: Partial<BriefSpec> };

const DEFAULT_SPEC: BriefSpec = {
  audience: "The business's target customers",
  objective: "Earn qualified attention and drive one clear business action",
  tone: "Warm, specific, confident",
  contentMode: "balanced",
  visualStyle: "Clean premium editorial",
  creativeDirection: "Make every post specific, useful, visually clear, and easy to understand on a phone.",
};

export function briefSpec(brief: Brief): BriefSpec {
  const provided = Object.fromEntries(Object.entries(brief.spec ?? {}).filter(([, value]) => value !== undefined && value !== ""));
  return { ...DEFAULT_SPEC, ...provided } as BriefSpec;
}

const PILLAR_TEXT: Record<Pillar, string> = {
  farm_tip: "Farm tip: one practical tip for broiler, layer or local chicken farmers.",
  calculator_demo: "Calculator demo: a free calculator in the app solving a real question, such as feed cost or break-even price.",
  problem_fix: "Problem and fix: a common loss (mortality, missed vaccines, lost records) and the app feature that handles it.",
  app_walkthrough: "App walkthrough: 20 to 30 seconds of one app screen doing one job.",
  install_ask: "Direct install ask: what is free, and the link.",
  education: "Education: teach one specific, useful idea the audience can apply now.",
  product_demo: "Product demo: show one real product workflow and its useful payoff.",
  problem_solution: "Problem and solution: open on a concrete pain, then reveal the fix.",
  behind_scenes: "Behind the scenes: make the real process, craft, or people tangible.",
  social_proof: "Evidence-led proof: use only verified facts supplied for the business.",
  offer: "Offer: clearly explain the offer without fake urgency or unsupported claims.",
  founder_story: "Founder story: turn one true decision, lesson, or belief into a memorable story.",
  event: "Event: explain why the event matters and what the audience should do next.",
};

const Draft = z.object({
  hook: z.string().describe("First line that stops the scroll, under 100 characters"),
  caption: z.string().describe("Full caption. Ends with one clear call to action for the business. No URL and no hashtags in the caption; hashtags go in the hashtags field."),
  hashtags: z.array(z.string()).describe("Hashtags with the # sign"),
  visual: z.object({
    headline: z.string().describe("Big text on the card or first slide, under 8 words"),
    body: z.string().describe("Supporting line on the card, under 25 words"),
    slides: z.array(z.string()).describe("Carousel: 3 to 5 slide texts. Video: 3 to 5 on-screen text beats. Image: empty"),
    eyebrow: z.string().describe("Short category label for the image or video, under 4 words"),
    artDirection: z.string().describe("One concise premium visual direction for the renderer or designer"),
  }),
});
const Drafts = z.object({ posts: z.array(Draft) });

const rulesFor = (brand: string) => `You are the senior social creative director for ${brand}.
Every post belongs to its pillar, uses its format, and ends with one clear call to action for ${brand}.
Use plain language for the verified audience. Never invent prices, currency, discounts, availability, or outcomes.
Create premium content with one sharp angle, immediate phone-screen clarity, and a useful payoff worth saving or sharing.
Avoid generic openings, vague motivation, repeated ideas, filler adjectives, empty drama, and captions that merely repeat the visual.
Use an open loop, tension, contrast, or a concrete audience decision to earn the next second or swipe.
Every hook must work without the caption. Every visual must be readable in one glance.
For carousels, build a clear sequence from hook to useful proof to action. For video, make each beat a visible action or reveal.
Never invent testimonials, customer names, user counts, results, awards, features, or guarantees. Never use deceptive urgency or fake scarcity.
Never suggest copyrighted music or trending audio. Describe original or uploaded licensed sound only.
Anything not in FACTS cannot be stated as fact.`;

// Models sometimes repeat hashtags at the end of the caption; they are published from the hashtags field.
export const stripTrailingHashtags = (c: string) => c.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, "").trim();

const prompt = (channel: Channel) => readFileSync(join(process.cwd(), "content", "prompts", `${channel}.md`), "utf8");

type BusinessContext = {
  id: number;
  name: string;
  domain: string | null;
  description: string | null;
  facts: Record<string, unknown>;
  strategy: Record<string, unknown>;
};

async function contextFor(businessId: number): Promise<BusinessContext> {
  const [business] = await sql<BusinessContext[]>`
    SELECT id, name, domain, description, facts, strategy FROM businesses WHERE id = ${businessId}`;
  if (!business) throw new Error(`Business ${businessId} does not exist`);
  return business;
}

async function assetContext(businessId: number) {
  return sql<{ kind: string; name: string; url: string }[]>`
    SELECT kind, name, url FROM assets WHERE business_id = ${businessId} AND active ORDER BY
    CASE kind WHEN 'logo' THEN 1 WHEN 'screenshot' THEN 2 WHEN 'audio' THEN 3 ELSE 4 END, created_at DESC`;
}

export async function writeChannel(
  brief: Brief, channel: Channel, slots: Slot[], winners: string[], feedback?: string,
): Promise<NewPost[]> {
  const lim = LIMITS[channel];
  const spec = briefSpec(brief);
  const businessId = brief.business_id ?? 1;
  const [business, assets] = await Promise.all([contextFor(businessId), assetContext(businessId)]);
  const facts = JSON.stringify({
    name: business.name,
    domain: business.domain,
    description: business.description,
    facts: business.facts,
    strategy: business.strategy,
    legacyFacts: business.id === 1 ? readFacts() : undefined,
  }, null, 2);
  const { posts } = await generateJson(
    Drafts,
    `${rulesFor(business.name)}

<channel_rules>
${prompt(channel)}
</channel_rules>

<facts>
${facts}
</facts>
<available_assets>
${JSON.stringify(assets, null, 2)}
</available_assets>`,
    [
      [
        "Creative brief.",
        `Stage of the business: ${brief.stage}.`,
        `Today's push: ${brief.push}.`,
        `Audience: ${spec.audience}.`,
        `Campaign objective: ${spec.objective}.`,
        `Tone: ${spec.tone}.`,
        `Visual style: ${spec.visualStyle}.`,
        `Direction: ${spec.creativeDirection}.`,
      ].join("\n"),
      winners.length ? `Last week's best posts (learn from their hooks and formats):\n- ${winners.join("\n- ")}` : "No winners yet.",
      `Write exactly ${slots.length} ${channel} post(s), in this order:`,
      ...slots.map((s, i) => `${i + 1}. Pillar: ${PILLAR_TEXT[s.pillar]} Format: ${s.format}.`),
      `Limits: caption at most ${lim.caption} characters, at most ${lim.hashtags} hashtags.`,
      "Give each post a distinct hook architecture. Do not recycle the same sentence pattern within this set.",
      feedback ? `A previous draft failed review for these reasons. Fix every one:\n${feedback}` : "",
    ].join("\n\n"),
  );
  if (posts.length !== slots.length) throw new Error(`writer returned ${posts.length} posts for ${channel}, wanted ${slots.length}`);
  return posts.map((d, i) => ({
    business_id: businessId,
    brief_id: brief.id ?? null,
    channel,
    pillar: slots[i].pillar,
    format: slots[i].format,
    hook: d.hook,
    caption: stripTrailingHashtags(d.caption),
    hashtags: d.hashtags,
    install_link: installLink(channel, business.domain ? `https://${business.domain}` : process.env.PLAY_STORE_URL),
    visual: {
      ...d.visual,
      logoUrl: assets.find((asset) => asset.kind === "logo")?.url,
      screenUrl: assets.find((asset) => asset.kind === "screenshot" || asset.kind === "video")?.url,
      imageUrl: assets.find((asset) => asset.kind === "image")?.url,
      soundtrackUrl: assets.find((asset) => asset.kind === "audio")?.url,
      brandName: business.name,
      ctaText: business.domain ? `Visit ${business.domain}` : "Learn more today",
    },
  }));
}

/** Brief -> 6 checked drafts. A failing post is rewritten once, then dropped. */
export async function generatePosts(
  brief: Brief, opts: { history?: Partial<Record<Pillar, number>>; winners?: string[] } = {},
): Promise<{ kept: NewPost[]; dropped: { post: NewPost; check: CheckResult }[] }> {
  const business = await contextFor(brief.business_id ?? 1);
  const facts = JSON.stringify({ business: business.facts, strategy: business.strategy, legacyFacts: business.id === 1 ? readFacts() : undefined });
  const slots = planDay(opts.history, { contentMode: briefSpec(brief).contentMode });
  const kept: NewPost[] = [];
  const dropped: { post: NewPost; check: CheckResult }[] = [];
  await Promise.all(ACTIVE_CHANNELS.map(async (channel) => {
    const mine = slots.filter((s) => s.channel === channel);
    const drafts = await writeChannel(brief, channel, mine, opts.winners ?? []);
    for (const [i, post] of drafts.entries()) {
      let check = await checkPost(post, facts);
      if (check.pass) { kept.push(post); continue; }
      const [retry] = await writeChannel(brief, channel, [mine[i]], opts.winners ?? [], check.violations.join("\n"));
      const recheck = await checkPost(retry, facts);
      if (recheck.pass) kept.push({ ...retry, check_notes: `rewritten: ${check.violations.join("; ")}` });
      else { check = recheck; dropped.push({ post: retry, check }); }
    }
  }));
  return { kept, dropped };
}

export async function latestBrief(businessId = 1): Promise<Brief | undefined> {
  const [b] = await sql<Brief[]>`SELECT id, business_id, stage, push, spec FROM briefs WHERE business_id = ${businessId} ORDER BY created_at DESC LIMIT 1`;
  return b ? { ...b, spec: briefSpec(b) } : undefined;
}

/** Daily job step 2-4: generate, check, and save drafts for the latest brief. */
export async function generateDay(businessId = 1): Promise<{ saved: Post[]; dropped: number }> {
  const brief = await latestBrief(businessId);
  if (!brief) throw new Error("No brief yet. Type one in the app first.");
  const [hist, winners, autoApprove] = await Promise.all([
    sql<{ pillar: Pillar; n: number }[]>`
      SELECT pillar, count(*)::int AS n FROM posts WHERE business_id = ${businessId} AND created_at > now() - interval '30 days' GROUP BY pillar`,
    sql<{ line: string }[]>`
      SELECT p.pillar || ' / ' || p.format || ': ' || p.hook AS line
      FROM posts p JOIN LATERAL (SELECT views FROM metrics m WHERE m.post_id = p.id ORDER BY collected_at DESC LIMIT 1) m ON true
      WHERE p.business_id = ${businessId} AND p.published_at > now() - interval '7 days' AND m.views IS NOT NULL
      ORDER BY m.views DESC LIMIT 5`,
    autoApproveEnabled(),
  ]);
  const { kept, dropped } = await generatePosts(brief, {
    history: Object.fromEntries(hist.map((h) => [h.pillar, h.n])),
    winners: winners.map((w) => w.line),
  });
  const saved = await saveCheckedPosts(kept, autoApprove);
  return { saved, dropped: dropped.length };
}

export async function generateAllBusinesses(): Promise<{ saved: number; dropped: number; skipped: number }> {
  const businesses = await sql<{ id: number }[]>`
    SELECT DISTINCT b.id FROM businesses b JOIN briefs br ON br.business_id = b.id`;
  let saved = 0;
  let dropped = 0;
  let skipped = 0;
  for (const business of businesses) {
    const run = await startRun("generate", false, business.id);
    if ("refused" in run) { skipped++; continue; }
    try {
      const result = await generateDay(business.id);
      saved += result.saved.length;
      dropped += result.dropped;
      await finishRun(run.id, `saved ${result.saved.length}, dropped ${result.dropped}`);
    } catch (error) {
      await finishRun(run.id, error instanceof Error ? error.message : String(error), true);
      throw error;
    }
  }
  return { saved, dropped, skipped };
}

export async function saveCheckedPosts(kept: NewPost[], autoApprove: boolean): Promise<Post[]> {
  const saved: Post[] = [];
  for (const p of kept) {
    const post = await insertPost(p);
    if (autoApprove) {
      const approved = await approvePost(post.id, {}, post.business_id ?? 1);
      if (!approved) throw new Error(`Could not auto-approve post ${post.id}`);
      saved.push(approved);
    } else saved.push(post);
  }
  return saved;
}
