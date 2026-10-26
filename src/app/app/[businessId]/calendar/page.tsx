import { calendarData } from "@/server/insights";
import { CalendarView } from "@/features/calendar/calendar-view";
import { PageHeading } from "@/components/ui/page-heading";
import { canManage } from "@/lib/validation";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ day?: string; view?: string }>;
}) {
  const { businessId } = await params;
  const data = await calendarData(businessId, await searchParams);
  return (
    <>
      <PageHeading
        title="Your appointment calendar"
        description="Plan the day, look ahead and keep your team in view."
      />
      <CalendarView
        businessId={businessId}
        timezone={data.scope.business.timezone}
        day={data.day}
        mode={data.mode}
        truncated={data.truncated}
        manage={canManage(data.scope.member.role)}
        canReschedule={process.env.BOOKING_MVP_ENABLED === "true"}
        appointments={data.rows.map((a) => ({
          ...a,
          startsAt: a.startsAt.toISOString(),
          endsAt: a.endsAt.toISOString(),
          customer: a.customer.name,
          service: a.serviceNameSnapshot ?? a.service.name,
          staff: a.staff.name,
        }))}
        staff={data.staff.map((s) => ({
          ...s,
          rules: s.availability,
          timeOff: s.exceptions.map((e) => ({
            startsAt: e.startsAt.toISOString(),
            endsAt: e.endsAt.toISOString(),
          })),
        }))}
      />
    </>
  );
}
export const dynamic = "force-dynamic";
