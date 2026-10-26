import "server-only";
import { db } from "@/lib/db";
import { assertCatalogEntitlement } from "./billing";
import { enqueueAppointmentNotifications } from "./notification-jobs";
import { prepareCatalog } from "./catalog";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantContext } from "@/server/authorization";
import type { z } from "zod";
import type {
  businessSchema,
  serviceSchema,
  staffSchema,
  customerSchema,
  serviceEditSchema,
  staffEditSchema,
  staffScheduleSchema,
} from "@/lib/validation";
import { canManage, markets } from "@/lib/validation";
type BusinessInput = z.infer<typeof businessSchema>;
export function createOwnedBusiness(actorId: string, input: BusinessInput) {
  return db().$transaction(async (tx) => {
    const b = await tx.business.create({
      data: {
        ...input,
        currency: markets[input.country].currency,
        members: { create: { userId: actorId, role: "OWNER" } },
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: b.id,
        actorId,
        action: "business.created",
        entityId: b.id,
      },
    });
    return b;
  });
}
export function readWorkspace(scope: TenantContext) {
  const businessId = scope.businessId;
  return Promise.all([
    db().service.findMany({
      where: { businessId },
      include: { category: true, components: true },
      orderBy: { name: "asc" },
    }),
    db().staff.findMany({
      where: { businessId },
      include: {
        services: true,
        availability: true,
        exceptions: {
          where: { unavailable: true },
          orderBy: { startsAt: "asc" },
          take: 100,
        },
      },
      orderBy: { name: "asc" },
    }),
    db().customer.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db().appointment.findMany({
      where: { businessId },
      include: { customer: true, staff: true, service: true },
      orderBy: { startsAt: "desc" },
      take: 100,
    }),
  ]);
}
export function readDashboardCounts(scope: TenantContext) {
  const businessId = scope.businessId;
  return Promise.all([
    db().appointment.count({ where: { businessId } }),
    db().service.count({ where: { businessId, active: true } }),
    db().staff.count({ where: { businessId, active: true } }),
    db().customer.count({ where: { businessId } }),
  ]);
}
type NewRecord =
  | { kind: "services"; input: z.infer<typeof serviceSchema> }
  | { kind: "staff"; input: z.infer<typeof staffSchema> }
  | { kind: "customers"; input: z.infer<typeof customerSchema> };
export async function requireCurrentManager(
  tx: Prisma.TransactionClient,
  scope: TenantContext,
) {
  const members = await tx.$queryRaw<{ role: string }[]>`
    SELECT "role" FROM "BusinessMember"
    WHERE "businessId" = ${scope.businessId} AND "userId" = ${scope.actorId}
    FOR SHARE
  `;
  if (!canManage(members[0]?.role ?? ""))
    throw new Error("Tenant write denied");
}
export function updateCatalogRecord(
  scope: TenantContext,
  record:
    | { kind: "services"; input: z.infer<typeof serviceEditSchema> }
    | { kind: "staff"; input: z.infer<typeof staffEditSchema> },
) {
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    const { id } = record.input;
    if (record.input.active)
      await assertCatalogEntitlement(tx, scope, record.kind, id);
    let result: { count: number };
    if (record.kind === "services") {
      await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "businessId"=${scope.businessId} AND "id"=${id} FOR UPDATE`;
      const prepared = await prepareCatalog(tx, scope, record.input, id);
      result = await tx.service.updateMany({
        where: { id, businessId: scope.businessId },
        data: prepared.data,
      });
      await tx.serviceComponent.deleteMany({
        where: { businessId: scope.businessId, packageId: id },
      });
      if (prepared.components.length)
        await tx.serviceComponent.createMany({
          data: prepared.components.map((c) => ({
            ...c,
            businessId: scope.businessId,
            packageId: id,
          })),
        });
    } else {
      result = await tx.staff.updateMany({
        where: { id, businessId: scope.businessId },
        data: {
          name: record.input.name,
          active: record.input.active,
          bufferBeforeMinutes: record.input.bufferBeforeMinutes,
          bufferAfterMinutes: record.input.bufferAfterMinutes,
        },
      });
    }
    if (result.count !== 1) throw new Error("Record not found");
    await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: `${record.kind}.updated`,
        entityId: id,
      },
    });
  });
}
export function replaceStaffSchedule(
  scope: TenantContext,
  input: z.infer<typeof staffScheduleSchema>,
) {
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Staff" WHERE "businessId" = ${scope.businessId} AND "id" = ${input.staffId} FOR UPDATE
    `;
    if (!locked.length) throw new Error("Staff not found");
    const ids = [...new Set(input.serviceIds)];
    const count = await tx.service.count({
      where: { id: { in: ids }, businessId: scope.businessId },
    });
    if (count !== ids.length) throw new Error("Service not found");
    await tx.staffService.deleteMany({
      where: { businessId: scope.businessId, staffId: input.staffId },
    });
    if (ids.length)
      await tx.staffService.createMany({
        data: ids.map((serviceId) => ({
          businessId: scope.businessId,
          staffId: input.staffId,
          serviceId,
        })),
      });
    await tx.availabilityRule.deleteMany({
      where: { businessId: scope.businessId, staffId: input.staffId },
    });
    if (input.rules.length)
      await tx.availabilityRule.createMany({
        data: input.rules.map((rule) => ({
          ...rule,
          businessId: scope.businessId,
          staffId: input.staffId,
        })),
      });
    await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: "staff.schedule.updated",
        entityId: input.staffId,
      },
    });
  });
}
export function transitionAppointment(
  scope: TenantContext,
  id: string,
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
) {
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    const updated = await tx.appointment.updateMany({
      where: {
        id,
        businessId: scope.businessId,
        status: {
          in: status === "CONFIRMED" ? ["PENDING"] : ["PENDING", "CONFIRMED"],
        },
      },
      data: { status },
    });
    if (updated.count !== 1)
      throw new Error("Appointment not found or already closed");
    const event = await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: `appointment.${status.toLowerCase()}`,
        entityId: id,
      },
    });
    if (status === "CONFIRMED" || status === "CANCELLED")
      await enqueueAppointmentNotifications(
        tx,
        scope.businessId,
        id,
        status,
        event.id,
      );
  });
}
export function createStaffTimeOff(
  scope: TenantContext,
  staffId: string,
  startsAt: Date,
  endsAt: Date,
) {
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Staff" WHERE "businessId" = ${scope.businessId} AND "id" = ${staffId} FOR UPDATE
    `;
    if (!locked.length) throw new Error("Staff not found");
    const conflicts = await tx.appointment.count({
      where: {
        businessId: scope.businessId,
        staffId,
        status: { not: "CANCELLED" },
        occupiedStartsAt: { lt: endsAt },
        occupiedEndsAt: { gt: startsAt },
      },
    });
    if (conflicts)
      throw new Error("Existing appointment conflicts with time off");
    const exception = await tx.scheduleException.create({
      data: {
        businessId: scope.businessId,
        staffId,
        startsAt,
        endsAt,
        unavailable: true,
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: "staff.time_off.created",
        entityId: exception.id,
      },
    });
  });
}
export function removeStaffTimeOff(
  scope: TenantContext,
  staffId: string,
  id: string,
) {
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Staff" WHERE "businessId" = ${scope.businessId} AND "id" = ${staffId} FOR UPDATE
    `;
    if (!locked.length) throw new Error("Staff not found");
    const deleted = await tx.scheduleException.deleteMany({
      where: { id, businessId: scope.businessId, staffId, unavailable: true },
    });
    if (deleted.count !== 1) throw new Error("Time off not found");
    await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: "staff.time_off.removed",
        entityId: id,
      },
    });
  });
}
export function insertRecord(scope: TenantContext, record: NewRecord) {
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    const businessId = scope.businessId;
    if (record.kind === "services" || record.kind === "staff")
      await assertCatalogEntitlement(tx, scope, record.kind);
    let entity: { id: string };
    switch (record.kind) {
      case "services": {
        const prepared = await prepareCatalog(tx, scope, record.input);
        entity = await tx.service.create({
          data: { ...prepared.data, businessId },
        });
        if (prepared.components.length)
          await tx.serviceComponent.createMany({
            data: prepared.components.map((c) => ({
              ...c,
              businessId,
              packageId: entity.id,
            })),
          });
        break;
      }
      case "staff":
        entity = await tx.staff.create({
          data: { ...record.input, businessId },
        });
        break;
      case "customers":
        entity = await tx.customer.create({
          data: {
            ...record.input,
            businessId,
            email: record.input.email || null,
            phone: record.input.phone || null,
          },
        });
        break;
    }
    await tx.auditLog.create({
      data: {
        businessId,
        actorId: scope.actorId,
        action: `${record.kind}.created`,
        entityId: entity.id,
      },
    });
  });
}
export function updateProfile(scope: TenantContext, input: BusinessInput) {
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    await tx.business.update({ where: { id: scope.businessId }, data: input });
    await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: "business.updated",
        entityId: scope.businessId,
      },
    });
  });
}
