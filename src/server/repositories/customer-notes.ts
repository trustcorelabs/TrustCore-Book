import "server-only";
import { db } from "@/lib/db";
import type { TenantContext } from "@/server/authorization";
import { requireCurrentManager } from "./workspace";
// Private notes never join public booking or general workspace projections.
export function readCustomerNotes(scope: TenantContext, customerId: string) {
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    return tx.customerNote.findMany({
      where: { businessId: scope.businessId, customerId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    });
  });
}
export function insertCustomerNote(
  scope: TenantContext,
  customerId: string,
  body: string,
) {
  return db().$transaction(async (tx) => {
    await requireCurrentManager(tx, scope);
    const customer = await tx.customer.findFirst({
      where: { businessId: scope.businessId, id: customerId },
      select: { id: true },
    });
    if (!customer) throw Error("Customer unavailable");
    const note = await tx.customerNote.create({
      data: {
        businessId: scope.businessId,
        customerId,
        authorId: scope.actorId,
        body,
      },
    });
    await tx.auditLog.create({
      data: {
        businessId: scope.businessId,
        actorId: scope.actorId,
        action: "customer.note.created",
        entityId: customerId,
      },
    });
    return note.id;
  });
}
