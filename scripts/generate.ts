// Daily step 2-4: brief -> 6 checked drafts. Runs on GitHub Actions (can take minutes on the free Gemini tier).
import { generateDay } from "../src/lib/writer.ts";
import { sql } from "../src/lib/db.ts";

const { saved, dropped } = await generateDay();
console.log(`saved ${saved.length} drafts, dropped ${dropped}`);
await sql.end();
