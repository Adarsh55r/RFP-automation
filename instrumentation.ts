/**
 * Runs once when a server instance starts, before it serves requests.
 * Upgrades an older database in place so a deploy never runs new code
 * against an old schema.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) {
    return;
  }
  try {
    const { upgradeSchemaIfNeeded } = await import("@/lib/schema-upgrade");
    await upgradeSchemaIfNeeded();
  } catch (error) {
    console.error("[schema-upgrade] Could not upgrade the database schema:", error);
  }
}
