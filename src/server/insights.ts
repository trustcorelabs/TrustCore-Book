import "server-only";
import { requireTenant } from "./authorization";
import {
  readCalendar,
  readReportAppointments,
  readAudit,
  readCustomerHistory,
} from "./repositories/insights";
import { businessLocalDate } from "@/features/booking-engine/slots";
import {
  boundedDateRange,
  calendarDays,
  shiftDay,
  validDay,
  type CalendarMode,
} from "@/features/calendar/dates";
import { rateLimit } from "./rate-limit";
import { notFound } from "next/navigation";
export async function calendarData(
  businessId: string,
  input: { day?: string; view?: string },
) {
  const scope = await requireTenant(businessId);
  const mode: CalendarMode = ["day", "week", "month"].includes(input.view ?? "")
    ? (input.view as CalendarMode)
    : "week";
  const day =
    input.day &&
    validDay(input.day) &&
    input.day >= "1901-01-01" &&
    input.day <= "2199-12-31"
      ? input.day
      : businessLocalDate(new Date(), scope.business.timezone);
  const days = calendarDays(day, mode);
  const range = boundedDateRange(
    days[0]!,
    days.at(-1)!,
    scope.business.timezone,
    42,
  );
  const result = await readCalendar(scope.context, range.from, range.to);
  return { scope, mode, day, days, ...result };
}
export async function reportingData(
  businessId: string,
  input: { from?: string; to?: string },
  manage = false,
) {
  const scope = await requireTenant(businessId, manage);
  await rateLimit(
    `${manage ? "report-export" : "report-read"}:${scope.user.id}`,
    manage ? 10 : 30,
    60,
  );
  const today = businessLocalDate(new Date(), scope.business.timezone);
  const from = input.from ?? shiftDay(today, -29),
    to = input.to ?? today;
  let range;
  try {
    range = boundedDateRange(from, to, scope.business.timezone);
  } catch {
    return {
      scope,
      from,
      to,
      error: "Choose a valid date range of up to 93 days.",
    } as const;
  }
  return {
    scope,
    from,
    to,
    ...(await readReportAppointments(scope.context, range.from, range.to)),
  } as const;
}
export async function auditData(businessId: string) {
  const scope = await requireTenant(businessId, true);
  return { scope, rows: await readAudit(scope.context) };
}
export async function customerHistory(businessId: string, customerId: string) {
  const scope = await requireTenant(businessId);
  if (!/^[a-z0-9]{15,40}$/.test(customerId)) notFound();
  const customer = await readCustomerHistory(scope.context, customerId);
  if (!customer) notFound();
  return { scope, customer };
}
