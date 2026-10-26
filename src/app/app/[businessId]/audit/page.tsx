import { auditData } from "@/server/insights";
import { PageHeading } from "@/components/ui/page-heading";
import { DataTable } from "@/components/data-table";
import { localTime } from "@/lib/utils";
export default async function Page({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const d = await auditData((await params).businessId);
  return (
    <>
      <PageHeading
        title="Workspace audit log"
        description="The latest 100 recorded workspace events. Only owners and admins can open this view."
      />
      <DataTable
        columns={[
          { key: "when", label: "When" },
          { key: "action", label: "Action" },
          { key: "actor", label: "Actor" },
          { key: "entity", label: "Record ID" },
        ]}
        rows={d.rows.map((a) => ({
          when: localTime(a.createdAt, d.scope.business.timezone),
          action: a.action,
          actor: a.actor?.name ?? "System / unavailable",
          entity: a.entityId ?? "—",
        }))}
        emptyTitle="No workspace events recorded"
        emptyDescription="New audited actions will appear here."
      />
    </>
  );
}
export const dynamic = "force-dynamic";
