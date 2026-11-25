import { sql } from "./db.ts";

export async function autoApproveEnabled(): Promise<boolean> {
  const [settings] = await sql<{ auto_approve: boolean }[]>`
    SELECT auto_approve FROM app_settings WHERE id = true`;
  return settings?.auto_approve === true;
}

export async function setAutoApprove(enabled: boolean): Promise<void> {
  await sql`
    INSERT INTO app_settings (id, auto_approve) VALUES (true, ${enabled})
    ON CONFLICT (id) DO UPDATE SET auto_approve = EXCLUDED.auto_approve`;
}
