import type { Channel, Format, Pillar } from "./posts.ts";
import type { ContentMode } from "./writer.ts";

// Target share of posts per pillar (spec: Content rules).
export const PILLAR_MIX: Record<Pillar, number> = {
  farm_tip: 0.08, calculator_demo: 0.04, problem_fix: 0.06, app_walkthrough: 0.04, install_ask: 0.03,
  education: 0.2, product_demo: 0.15, problem_solution: 0.15, behind_scenes: 0.08, social_proof: 0.05,
  offer: 0.05, founder_story: 0.04, event: 0.03,
};

// Facebook is posted by hand (no automatic posting yet) but still gets 2 posts a day.
export const DAILY_SLOTS: Channel[] = ["facebook", "facebook", "youtube", "tiktok", "tiktok", "x", "x", "whatsapp"];

// Caption limits we enforce (platform max is higher on Facebook; 2200 keeps posts readable and portable).
export const LIMITS: Record<Channel, { caption: number; hashtags: number; hook: number }> = {
  facebook: { caption: 2200, hashtags: 5, hook: 120 },
  instagram: { caption: 2200, hashtags: 10, hook: 120 },
  youtube: { caption: 5000, hashtags: 15, hook: 100 },
  tiktok: { caption: 2200, hashtags: 6, hook: 120 },
  x: { caption: 280, hashtags: 3, hook: 100 },
  whatsapp: { caption: 1200, hashtags: 0, hook: 120 },
};

export type Slot = { channel: Channel; pillar: Pillar; format: Format };

/**
 * Picks 6 pillars for today so the running totals track PILLAR_MIX.
 * `history` = how many posts of each pillar were planned before (e.g. last 30 days).
 */
export function planDay(
  history: Partial<Record<Pillar, number>> = {},
  options: { contentMode?: ContentMode } = {},
): Slot[] {
  const counts = { ...Object.fromEntries(Object.keys(PILLAR_MIX).map((p) => [p, 0])), ...history } as Record<Pillar, number>;
  let total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pillars: Pillar[] = [];
  for (let i = 0; i < DAILY_SLOTS.length; i++) {
    total++;
    // largest deficit against target wins; ties go to the bigger pillar
    const pick = (Object.keys(PILLAR_MIX) as Pillar[]).reduce((best, p) =>
      PILLAR_MIX[p] * total - counts[p] > PILLAR_MIX[best] * total - counts[best] ? p : best,
    );
    counts[pick]++;
    pillars.push(pick);
  }
  // Walkthroughs need video, so put them last (TikTok slots).
  pillars.sort((a, b) => Number(a === "app_walkthrough") - Number(b === "app_walkthrough"));
  return DAILY_SLOTS.map((channel, i) => ({
    channel,
    pillar: pillars[i],
    format: formatFor(channel, pillars[i], i, options.contentMode ?? "balanced"),
  }));
}

function formatFor(channel: Channel, pillar: Pillar, i: number, contentMode: ContentMode): Format {
  if (channel === "youtube" || channel === "tiktok" || contentMode === "video") return "video";
  if (contentMode === "image" && (channel === "x" || channel === "whatsapp")) return i % 2 ? "carousel" : "image";
  if (contentMode === "image")
    return pillar === "calculator_demo" || pillar === "problem_fix" || (channel === "instagram" && i % 2)
      ? "carousel"
      : "image";
  if (pillar === "app_walkthrough") return "video";
  if (pillar === "calculator_demo" || pillar === "problem_fix") return "carousel";
  return channel === "instagram" && i % 2 ? "carousel" : "image";
}

// Publishing slots, Kampala time (UTC+3, no daylight saving).
export const SLOT_TIMES: Record<Channel, number[]> = {
  facebook: [9, 15], instagram: [12, 19], youtube: [16], tiktok: [13, 18], x: [10, 17], whatsapp: [8],
};
const KAMPALA_OFFSET_H = 3;

/** First free slot for `channel` that is still in the future: today, else tomorrow, and so on. */
export function nextSlot(channel: Channel, taken: Date[], now = new Date()): Date {
  const busy = new Set(taken.map((d) => d.getTime()));
  const local = new Date(now.getTime() + KAMPALA_OFFSET_H * 3600_000);
  for (let day = 0; day < 14; day++) {
    for (const h of SLOT_TIMES[channel]) {
      const t = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + day, h - KAMPALA_OFFSET_H));
      if (t > now && !busy.has(t.getTime())) return t;
    }
  }
  throw new Error(`No free ${channel} slot in the next 14 days`);
}

/** Start of the current Kampala day, as a UTC instant. */
export function kampalaDayStart(now = new Date(), addDays = 0): Date {
  const local = new Date(now.getTime() + KAMPALA_OFFSET_H * 3600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + addDays, -KAMPALA_OFFSET_H));
}

export function installLink(channel: Channel, base = process.env.PLAY_STORE_URL): string {
  if (!base) throw new Error("PLAY_STORE_URL is not set");
  const u = new URL(base);
  u.searchParams.set("utm_source", channel);
  u.searchParams.set("utm_medium", "social");
  u.searchParams.set("utm_campaign", "phase1");
  return u.toString();
}
