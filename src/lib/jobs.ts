import { sql } from "./db.ts";
import { kampalaDayStart } from "./plan.ts";

export const MANUAL_GENERATE_PER_DAY = 3; // ~3 main-model calls each; the free Gemini tier allows about 20 a day
const STALE_MIN = 10; // a run with no finish after this long is treated as dead

export type Run = { id: number; kind: string; manual: boolean; status: string; result: string | null; started_at: Date; finished_at: Date | null };

/** Starts a run unless one is already going or the manual daily cap is reached. Atomic across servers. */
export async function startRun(kind: string, manual: boolean, businessId = 1): Promise<{ id: number } | { refused: string }> {
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"job:" + businessId + ":" + kind}))`;
    const [busy] = await tx`SELECT id FROM job_runs WHERE business_id = ${businessId} AND kind = ${kind} AND status = 'running' AND started_at > now() - make_interval(mins => ${STALE_MIN})`;
    if (busy) return { refused: "A run is already in progress." };
    if (manual) {
      const [{ n }] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM job_runs WHERE business_id = ${businessId} AND kind = ${kind} AND manual AND started_at >= ${kampalaDayStart()}`;
      if (n >= MANUAL_GENERATE_PER_DAY) return { refused: `Daily limit reached (${MANUAL_GENERATE_PER_DAY} manual runs) to stay inside the free AI quota. Try again tomorrow.` };
    }
    const [r] = await tx<{ id: number }[]>`INSERT INTO job_runs (business_id, kind, manual) VALUES (${businessId}, ${kind}, ${manual}) RETURNING id`;
    return { id: r.id };
  });
}

export async function finishRun(id: number, result: string, failed = false): Promise<void> {
  await sql`UPDATE job_runs SET status = ${failed ? "failed" : "done"}, result = ${result.slice(0, 500)}, finished_at = now() WHERE id = ${id}`;
}

export async function generateStatus(businessId = 1): Promise<{ last: Run | null; manualToday: number }> {
  const [last] = await sql<Run[]>`SELECT * FROM job_runs WHERE business_id = ${businessId} AND kind = 'generate' ORDER BY started_at DESC LIMIT 1`;
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM job_runs WHERE business_id = ${businessId} AND kind = 'generate' AND manual AND started_at >= ${kampalaDayStart()}`;
  return { last: last ?? null, manualToday: n };
}
