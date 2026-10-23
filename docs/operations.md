# Operations: monitoring, backups and restore

## Monitoring
- **Uptime:** point a monitor (Vercel Monitoring, BetterStack, UptimeRobot) at `https://draftbidai.com/api/health`. It returns `200 {"ok":true}` when the app and database answer and `503` when the database doesn't. It reveals nothing else.
- **Errors and failed AI jobs:**
  - Every failed upload, extraction, draft and export is reported to Sentry with an `area` tag (`upload`, `extract`, `draft`, `export`, `delete-rfp`, …) once `NEXT_PUBLIC_SENTRY_DSN` is set.
  - In Sentry, add an alert rule "A new issue is created", or "more than N events in 1 hour", that emails you.
  - Reports never contain document text: see `lib/monitoring.ts` and `lib/safe-log.ts`.
- **AI spend:**
  - `ALERT_WEBHOOK_URL` receives one alert per account when it hits its daily or monthly AI ceiling;
  - `/admin/costs` shows the average and p95 cost per proposal;
  - `npm run report:ai-cost` gives the same from the command line.
- **Configuration drift:** `/admin/setup` shows every required setting, bucket privacy, database speed and placeholder legal details.

## Backups
- **Database (Neon):** Neon keeps a point-in-time history for the window your plan allows ({{BACKUP_RETENTION}}; check Neon → project → Settings → Storage / History retention). Restores are made as a new branch from a timestamp.
- **Uploaded files (Supabase Storage):** these are **not** included in Neon's history. Supabase does not version Storage objects by default, so a deleted file cannot be restored. Decide whether that's acceptable (customers delete their own files on purpose); if not, enable a storage backup or replication job. See FOUNDER_TODO.

## Restore test (run quarterly, and before launch)
1. In Neon, create a branch from a point in time:
   - **Console:** Branches → Create branch → "From a point in time", one hour ago;
   - **CLI:** `neonctl branches create --name restore-test --parent main --parent-timestamp 2026-10-23T09:00:00Z`.
2. Copy the branch's connection string.
3. Run:
   ```bash
   PRIMARY_DATABASE_URL="<live pooled URL>" RESTORE_DATABASE_URL="<branch URL>" node scripts/verify-restore.mjs
   ```
   It compares row counts and latest timestamps per table (read-only) and exits non-zero if a table that has data in production is empty in the restore.
4. Delete the `restore-test` branch.
5. Record the date, restore point and result in `UPGRADE_LOG.md`.

The restore test has **not** been run from this environment, because it has no access to the production database. It is a founder task before launch.
