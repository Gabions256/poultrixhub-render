import { sql } from "./db.ts";
import { nextSlot } from "./plan.ts";
import type { BriefSpec } from "./writer.ts";

export const CHANNELS = ["facebook", "instagram", "youtube", "tiktok", "x", "whatsapp"] as const;
export const ACTIVE_CHANNELS = ["facebook", "youtube", "tiktok", "x", "whatsapp"] as const;
export const PILLARS = [
  "farm_tip", "calculator_demo", "problem_fix", "app_walkthrough", "install_ask",
  "education", "product_demo", "problem_solution", "behind_scenes", "social_proof", "offer", "founder_story", "event",
] as const;
export const FORMATS = ["image", "carousel", "video"] as const;
export type Channel = (typeof CHANNELS)[number];
export type Pillar = (typeof PILLARS)[number];
export type Format = (typeof FORMATS)[number];
export type PostStatus = "draft" | "approved" | "publishing" | "published" | "failed" | "expired" | "deleted";

export type NewPost = {
  business_id?: number | null;
  brief_id?: number | null;
  channel: Channel;
  pillar: Pillar;
  format: Format;
  hook: string;
  caption: string;
  hashtags: string[];
  install_link: string;
  visual?: Record<string, unknown>;
  check_notes?: string | null;
};

export type Post = NewPost & {
  id: number;
  status: PostStatus;
  media_paths: string[];
  scheduled_for: Date | null;
  published_at: Date | null;
  external_id: string | null;
  attempts: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function insertPost(p: NewPost): Promise<Post> {
  const [row] = await sql<Post[]>`
    INSERT INTO posts (business_id, brief_id, channel, pillar, format, hook, caption, hashtags, install_link, visual, check_notes)
    VALUES (${p.business_id ?? 1}, ${p.brief_id ?? null}, ${p.channel}, ${p.pillar}, ${p.format}, ${p.hook}, ${p.caption},
            ${p.hashtags}, ${p.install_link}, ${sql.json((p.visual ?? {}) as never)}, ${p.check_notes ?? null})
    RETURNING *`;
  return row;
}

export async function getPost(id: number): Promise<Post | undefined> {
  const [row] = await sql<Post[]>`SELECT * FROM posts WHERE id = ${id}`;
  return row;
}

/** Approve a draft (optionally with edited text) into the next free slot of its channel. */
export async function approvePost(id: number, edits: { hook?: string; caption?: string } = {}, businessId = 1): Promise<Post | undefined> {
  return sql.begin(async (tx) => {
    const [p] = await tx<Post[]>`SELECT * FROM posts WHERE id = ${id} AND business_id = ${businessId} AND status = 'draft' FOR UPDATE`;
    if (!p) return undefined;
    // Serialize approvals per channel so two can't take the same slot (row locks miss empty slots).
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"slot:" + businessId + ":" + p.channel}))`;
    const taken = await tx<{ scheduled_for: Date }[]>`
      SELECT scheduled_for FROM posts WHERE business_id = ${businessId} AND channel = ${p.channel} AND status IN ('approved','publishing','published') AND scheduled_for > now()`;
    const slot = nextSlot(p.channel, taken.map((t) => t.scheduled_for));
    const [row] = await tx<Post[]>`
      UPDATE posts SET status = 'approved', scheduled_for = ${slot},
        hook = ${edits.hook ?? p.hook}, caption = ${edits.caption ?? p.caption}, updated_at = now()
      WHERE id = ${id} RETURNING *`;
    return row;
  });
}

export async function updateDraft(id: number, edits: { hook: string; caption: string }, businessId = 1): Promise<void> {
  await sql`UPDATE posts SET hook = ${edits.hook}, caption = ${edits.caption}, updated_at = now() WHERE id = ${id} AND business_id = ${businessId} AND status = 'draft'`;
}

export async function markPublishedByHand(id: number, businessId = 1): Promise<void> {
  await sql`UPDATE posts SET status = 'published', published_at = now(), updated_at = now() WHERE id = ${id} AND business_id = ${businessId} AND status = 'approved'`;
}

export async function deletePost(id: number, businessId = 1): Promise<void> {
  await sql`UPDATE posts SET status = 'deleted', updated_at = now() WHERE id = ${id} AND business_id = ${businessId} AND status IN ('draft','approved')`;
}

export async function postsScheduledBetween(from: Date, to: Date, businessId = 1): Promise<Post[]> {
  return sql<Post[]>`SELECT * FROM posts WHERE business_id = ${businessId} AND scheduled_for >= ${from} AND scheduled_for < ${to} AND status <> 'deleted' ORDER BY scheduled_for`;
}

export async function insertBrief(stage: string, push: string, spec: BriefSpec, businessId = 1): Promise<void> {
  await sql`INSERT INTO briefs (business_id, stage, push, spec) VALUES (${businessId}, ${stage}, ${push}, ${sql.json(spec as never)})`;
}

export async function listPosts(status?: PostStatus, limit = 50, businessId = 1): Promise<Post[]> {
  return status
    ? sql<Post[]>`SELECT * FROM posts WHERE business_id = ${businessId} AND status = ${status} ORDER BY created_at DESC LIMIT ${limit}`
    : sql<Post[]>`SELECT * FROM posts WHERE business_id = ${businessId} AND status <> 'deleted' ORDER BY created_at DESC LIMIT ${limit}`;
}
