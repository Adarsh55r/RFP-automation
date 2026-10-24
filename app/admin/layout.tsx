import { safeErrorSummary } from "@/lib/safe-log";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/admin";
import { getAlertCount } from "@/lib/admin-data";
import { getSetupAttentionCount } from "@/lib/setup-status";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminEmail = await requireAdminPage();
  const [alertCount, setupCount] = await Promise.all([
    getAlertCount().catch((error) => {
      console.error("[admin] alert count failed", safeErrorSummary(error));
      return 0;
    }),
    getSetupAttentionCount().catch(() => 0),
  ]);

  return (
    <AdminShell adminEmail={adminEmail} alertCount={alertCount} setupCount={setupCount}>
      {children}
    </AdminShell>
  );
}
