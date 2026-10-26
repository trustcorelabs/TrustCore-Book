import { reportingData } from "@/server/insights";
import { ReportView } from "@/features/reporting/report-view";
import { PageHeading } from "@/components/ui/page-heading";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/shared/policies/permissions";
import Link from "next/link";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { businessId } = await params;
  const d = await reportingData(businessId, await searchParams);
  return (
    <>
      <PageHeading
        title="Appointment reports"
        description="Defined date ranges. Actual records. No estimated revenue."
      />
      <form className="surface mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="report-from">From</label>
          <input
            className="input"
            id="report-from"
            type="date"
            name="from"
            defaultValue={d.from}
            required
          />
        </div>
        <div>
          <label htmlFor="report-to">To</label>
          <input
            className="input"
            id="report-to"
            type="date"
            name="to"
            defaultValue={d.to}
            required
          />
        </div>
        <Button type="submit">Apply dates</Button>
        {!d.error &&
          !d.truncated &&
          hasPermission(d.scope.member.role, "records.manage") && (
            <Button variant="outline" asChild>
              <Link
                prefetch={false}
                href={`/api/businesses/${businessId}/reports?from=${d.from}&to=${d.to}`}
              >
                Export CSV
              </Link>
            </Button>
          )}
      </form>
      {d.error ? (
        <p role="alert" className="notice">
          {d.error}
        </p>
      ) : (
        <ReportView
          from={d.from}
          to={d.to}
          timezone={d.scope.business.timezone}
          truncated={d.truncated}
          rows={d.rows.map((a) => ({
            ...a,
            startsAt: a.startsAt.toISOString(),
            endsAt: a.endsAt.toISOString(),
            service: a.serviceNameSnapshot ?? a.service.name,
            staff: a.staff.name,
          }))}
        />
      )}
    </>
  );
}
export const dynamic = "force-dynamic";
