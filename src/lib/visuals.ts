// Renders a post's media with Remotion. Runs on the render server (needs Chromium), not on Vercel.
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Channel, Format, NewPost, Pillar } from "./posts.ts";

type Visual = {
  headline?: string; body?: string; slides?: string[]; eyebrow?: string;
  logoUrl?: string; screenUrl?: string; imageUrl?: string; soundtrackUrl?: string; brandName?: string; ctaText?: string;
};
export type Size = "portrait" | "vertical";

// Feed images and carousels: 4:5 (1080x1350) on Facebook and Instagram. Video: 9:16 (1080x1920) everywhere.
export const sizeFor = (_channel: Channel, format: Format): Size => (format === "video" ? "vertical" : "portrait");

const CARD_FOR: Record<Pillar, string> = {
  farm_tip: "TipCard",
  install_ask: "TipCard",
  calculator_demo: "StatCard",
  problem_fix: "ProblemFixCard",
  app_walkthrough: "TipCard",
  education: "TipCard",
  product_demo: "StatCard",
  problem_solution: "ProblemFixCard",
  behind_scenes: "TipCard",
  social_proof: "StatCard",
  offer: "StatCard",
  founder_story: "TipCard",
  event: "TipCard",
};

let served: Promise<string> | undefined;
const serveUrl = () =>
  (served ??= bundle({ entryPoint: join(process.cwd(), "video", "index.ts"), publicDir: join(process.cwd(), "video", "public") }));

async function still(id: string, props: Record<string, unknown>, output: string) {
  const url = await serveUrl();
  const composition = await selectComposition({ serveUrl: url, id, inputProps: props });
  await renderStill({ serveUrl: url, composition, inputProps: props, output, imageFormat: "png" });
  return output;
}

/** Carousel slides: cover (headline), the writer's slides, then an install slide. Capped at 5 slides. */
export function carouselSlides(v: Visual): string[] {
  // Writers sometimes prefix slides with "Slide 1:"; the slide counter already shows the position.
  const middle = (v.slides ?? []).slice(0, 3).map((t) => t.replace(/^\s*slide\s*\d+\s*[:.\-–]\s*/i, ""));
  return [v.headline ?? "", ...middle, v.ctaText ?? "Learn more today."].filter(Boolean);
}

export async function renderPost(post: Pick<NewPost, "channel" | "pillar" | "format" | "visual"> & { id?: number }, outDir = join(process.cwd(), "media")): Promise<string[]> {
  const v = (post.visual ?? {}) as Visual;
  const size = sizeFor(post.channel, post.format);
  const base = join(outDir, `${post.id ?? "preview"}-${post.channel}-${post.format}`);
  mkdirSync(outDir, { recursive: true });

  if (post.format === "image") return [await still(CARD_FOR[post.pillar], {
    headline: v.headline ?? "",
    body: v.body ?? "",
    eyebrow: v.eyebrow ?? "",
    logoUrl: v.logoUrl,
    imageUrl: v.imageUrl,
    brandName: v.brandName,
    ctaText: v.ctaText,
    size,
  }, `${base}.png`)];

  if (post.format === "carousel") {
    const texts = carouselSlides(v);
    const out: string[] = [];
    for (const [i, text] of texts.entries())
      out.push(await still("CarouselSlide", {
        text, index: i + 1, total: texts.length, size, cta: i === texts.length - 1,
        logoUrl: v.logoUrl, brandName: v.brandName, ctaText: v.ctaText,
      }, `${base}-${i + 1}.png`));
    return out;
  }

  const beats = (v.slides ?? []).slice(0, 5);
  while (beats.length < 3) beats.push(beats.length ? "Free on Google Play" : (v.body ?? "PoultrixHub"));
  const props = {
    headline: v.headline ?? "",
    eyebrow: v.eyebrow ?? "",
    beats,
    logoUrl: v.logoUrl,
    recording: v.screenUrl,
    soundtrackUrl: v.soundtrackUrl,
    brandName: v.brandName,
    ctaText: v.ctaText,
  };
  const url = await serveUrl();
  const composition = await selectComposition({ serveUrl: url, id: "PromoVideo", inputProps: props });
  await renderMedia({ serveUrl: url, composition, inputProps: props, codec: "h264", outputLocation: `${base}.mp4` });
  return [`${base}.mp4`];
}

/** Renders one frame per beat of the video template; cheap way to prove its text fits. */
export async function renderVideoFrames(
  props: { headline: string; beats: string[]; logoUrl?: string; recording?: string; soundtrackUrl?: string },
  outDir: string,
): Promise<string[]> {
  const url = await serveUrl();
  const composition = await selectComposition({ serveUrl: url, id: "PromoVideo", inputProps: props });
  mkdirSync(outDir, { recursive: true });
  const out: string[] = [];
  for (let i = 0; i <= props.beats.length; i++) {
    const frame = Math.min(i * 135 + 60, composition.durationInFrames - 1);
    const output = join(outDir, `video-frame-${i}.png`);
    await renderStill({ serveUrl: url, composition, inputProps: props, output, frame, imageFormat: "png" });
    out.push(output);
  }
  return out;
}
