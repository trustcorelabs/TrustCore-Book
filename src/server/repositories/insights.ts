import "server-only";
import { db } from "@/lib/db";
import type { TenantContext } from "@/server/authorization";
export async function readCalendar(scope: TenantContext, from: Date, to: Date) {
  const [rows, staff] = await Promise.all([
    db().appointment.findMany({
      where: {
        businessId: scope.businessId,
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 2001,
      select: {
        id: true,
        staffId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        customer: { select: { name: true } },
        serviceNameSnapshot: true,
      service: { select: { name: true } },
        staff: { select: { name: true } },
      },
    }),
    db().staff.findMany({
      where: { businessId: scope.businessId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        active: true,
        availability: {
          where: { businessId: scope.businessId },
          select: { weekday: true, startMinute: true, endMinute: true },
        },
        exceptions: {
          where: {
            businessId: scope.businessId,
            unavailable: true,
            startsAt: { lt: to },
            endsAt: { gt: from },
          },
          select: { startsAt: true, endsAt: true },
        },
      },
    }),
  ]);
  return { rows: rows.slice(0, 2000), staff, truncated: rows.length > 2000 };
}
export async function readReportAppointments(
  scope: TenantContext,
  from: Date,
  to: Date,
) {
  const rows = await db().appointment.findMany({
    where: { businessId: scope.businessId, startsAt: { gte: from, lt: to } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 10001,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      staffId: true,
      serviceId: true,
      serviceNameSnapshot: true,
      service: { select: { name: true } },
      staff: { select: { name: true } },
    },
  });
  return { rows: rows.slice(0, 10000), truncated: rows.length > 10000 };
}
export function readAudit(scope: TenantContext, limit = 100) {
  return db().auditLog.findMany({
    where: { businessId: scope.businessId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(100, Math.max(1, Math.floor(limit))),
    select: {
      id: true,
      action: true,
      entityId: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
}
export function readCustomerHistory(scope: TenantContext, customerId: string) {
  return db().customer.findFirst({
    where: { id: customerId, businessId: scope.businessId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      appointments: {
        where: { businessId: scope.businessId },
        orderBy: { startsAt: "desc" },
        take: 101,
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          serviceNameSnapshot: true,
      service: { select: { name: true } },
          staff: { select: { name: true } },
        },
      },
    },
  });
}
