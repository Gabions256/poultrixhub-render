import postgres from "postgres";

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL is not set");
// The postgres client does not understand Neon's channel_binding parameter; SSL stays required via sslmode.
const u = new URL(raw);
u.searchParams.delete("channel_binding");
const url = u.toString();

// One pool per process; reused across hot reloads in dev.
const g = globalThis as unknown as { __sql?: postgres.Sql };
// prepare: false because Neon's pooled URL (PgBouncer, transaction mode) cannot keep prepared statements.
export const sql = g.__sql ?? postgres(url, { max: 5, prepare: false, idle_timeout: 20 });
if (process.env.NODE_ENV !== "production") g.__sql = sql;
