import { PageHeader } from "@/components/admin/admin-shell";
import { CustomersTable } from "@/components/admin/customers-table";
import { Pill } from "@/components/admin/ui";
import { getCustomers } from "@/lib/admin-data";
import { usd } from "@/lib/admin-format";

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, rows] = await Promise.all([searchParams, getCustomers()]);
  const paying = rows.filter((row) => row.revenueUsd > 0);
  const spend = rows.reduce((sum, row) => sum + row.aiCostMonthUsd, 0);

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Customers"
        description="Every account with its plan, monthly usage, remaining limits, AI calls and spend. Click a row for the full profile."
        actions={
          <div className="flex flex-wrap gap-2">
            <Pill>{rows.length} accounts</Pill>
            <Pill>{paying.length} paying</Pill>
            <Pill>{usd(spend)} AI spend this month</Pill>
          </div>
        }
      />
      <CustomersTable rows={rows} initialQuery={q ?? ""} />
    </>
  );
}
