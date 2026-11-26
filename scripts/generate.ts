// Daily step 2-4: brief -> 6 checked drafts. Runs on GitHub Actions (can take minutes on the free Gemini tier).
import { generateAllBusinesses } from "../src/lib/writer.ts";
import { sql } from "../src/lib/db.ts";

const result = await generateAllBusinesses();
console.log(`saved ${result.saved} posts, dropped ${result.dropped}, skipped ${result.skipped} running businesses`);
await sql.end();
