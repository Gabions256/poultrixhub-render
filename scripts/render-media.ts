// Renders images/videos for posts that have none yet, uploads them to Vercel Blob, saves the public URLs.
// Runs on GitHub Actions (Vercel cannot run Chromium/ffmpeg). Usage: npm run render
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { put } from "@vercel/blob";
import { sql } from "../src/lib/db.ts";
import { renderPost } from "../src/lib/visuals.ts";
import type { Post } from "../src/lib/posts.ts";

const posts = await sql<Post[]>`
  SELECT * FROM posts WHERE status IN ('draft','approved') AND cardinality(media_paths) = 0 ORDER BY created_at LIMIT 12`;
let ok = 0;
const failed: string[] = [];
for (const p of posts) {
  try {
    const files = await renderPost(p);
    const urls: string[] = [];
    for (const f of files) {
      const blob = await put(`posts/${p.id}/${basename(f)}`, readFileSync(f), { access: "public", addRandomSuffix: true });
      urls.push(blob.url);
    }
    await sql`UPDATE posts SET media_paths = ${urls}, updated_at = now() WHERE id = ${p.id}`;
    ok++;
    console.log(`post ${p.id}: ${urls.length} file(s)`);
  } catch (e) {
    failed.push(`post ${p.id}: ${e instanceof Error ? e.message : e}`);
  }
}
console.log(`rendered ${ok}/${posts.length}`);
await sql.end();
if (failed.length) {
  console.error(failed.join("\n"));
  process.exit(1); // fails the workflow so GitHub emails you
}
