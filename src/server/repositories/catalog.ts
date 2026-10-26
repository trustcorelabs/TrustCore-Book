import { db } from "@/lib/db";
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { TenantContext } from "@/server/authorization";
import { quoteCatalog } from "@/features/booking-engine/catalog";
export type CatalogInput = {
  name: string;
  durationMinutes: number;
  price: string;
  active?: boolean;
  kind: string;
  categoryId: string | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  components: { componentId: string; quantity: number }[];
};
export async function prepareCatalog(
  tx: Prisma.TransactionClient,
  scope: TenantContext,
  input: CatalogInput,
  id?: string,
) {
  const { components } = input;
  const data = {
    name: input.name,
    durationMinutes: input.durationMinutes,
    price: input.price,
    active: input.active,
    kind: input.kind,
    categoryId: input.categoryId,
    bufferBeforeMinutes: input.bufferBeforeMinutes,
    bufferAfterMinutes: input.bufferAfterMinutes,
  };
  if (
    data.categoryId &&
    !(await tx.serviceCategory.findFirst({
      where: { id: data.categoryId, businessId: scope.businessId },
      select: { id: true },
    }))
  )
    throw Error("Category unavailable");
  if (
    components.some((c) => c.componentId === id) ||
    new Set(components.map((c) => c.componentId)).size !== components.length
  )
    throw Error("Invalid package composition");
  const rows = components.length
    ? await tx.service.findMany({
        where: {
          businessId: scope.businessId,
          id: { in: components.map((c) => c.componentId) },
          active: true,
          kind: { not: "PACKAGE" },
        },
      })
    : [];
  if (
    rows.length !== components.length ||
    (data.kind !== "PACKAGE" && components.length)
  )
    throw Error("Invalid package composition");
  const resolved = components.map((c) => ({
    quantity: c.quantity,
    component: rows.find((r) => r.id === c.componentId)!,
  }));
  if (data.kind === "PACKAGE")
    data.durationMinutes = quoteCatalog(
      { ...data, id: id ?? "package", active: true },
      [],
      resolved,
    ).durationMinutes;
  if (id) {
    // Existing package compositions remain valid when an ordinary service is edited.
    const used = await tx.serviceComponent.count({
      where: { businessId: scope.businessId, componentId: id },
    });
    if (used) {
      const previous = await tx.service.findFirstOrThrow({
        where: { id, businessId: scope.businessId },
        select: { durationMinutes: true },
      });
      if (
        data.kind === "PACKAGE" ||
        previous.durationMinutes !== data.durationMinutes
      )
        throw Error(
          "Update package composition before changing a referenced component duration",
        );
    }
  }
  return { data, components };
}

export function readCategories(businessId: string) {
  return db().serviceCategory.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
export async function persistBookingPolicy(
  scope: TenantContext,
  data: {
    bookingLeadMinutes: number;
    cancellationNoticeMinutes: number;
    rescheduleNoticeMinutes: number;
    bookingHorizonDays: number;
  },
) {
  const { requireCurrentManager } = await import("./workspace");
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    await tx.business.update({ where: { id: scope.businessId }, data });
    await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: "booking.policy.updated",
        entityId: scope.businessId,
      },
    });
  });
}
export async function persistCategory(
  scope: TenantContext,
  data: { id?: string; name: string },
) {
  const { requireCurrentManager } = await import("./workspace");
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    if (data.id) {
      const result = await tx.serviceCategory.updateMany({
        where: { id: data.id, businessId: scope.businessId },
        data: { name: data.name },
      });
      if (result.count !== 1) throw Error("Category unavailable");
    } else
      await tx.serviceCategory.create({
        data: { businessId: scope.businessId, name: data.name },
      });
    await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: "service.category.saved",
        entityId: data.id,
      },
    });
  });
}
