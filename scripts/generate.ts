// Daily step 2-4: brief -> 6 checked drafts. Runs on GitHub Actions (can take minutes on the free Gemini tier).
import { generateDay } from "../src/lib/writer.ts";
import { startRun, finishRun } from "../src/lib/jobs.ts";
import { sql } from "../src/lib/db.ts";

const run = await startRun("generate", false);
if ("refused" in run) {
  console.log(`skipped: ${run.refused}`);
} else {
  try {
    const { saved, dropped } = await generateDay();
    await finishRun(run.id, `saved ${saved.length}, dropped ${dropped}`);
    console.log(`saved ${saved.length} drafts, dropped ${dropped}`);
  } catch (e) {
    await finishRun(run.id, e instanceof Error ? e.message : String(e), true);
    throw e;
  }
}
await sql.end();
