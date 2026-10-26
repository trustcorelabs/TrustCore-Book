import "server-only";
import { db } from "@/lib/db";
// Explicit public projection. No tenant/customer/staff IDs are returned.
export function findPublicBusiness(slug: string) {
  return db().business.findUnique({
    where: { slug },
    select: {
      name: true,
      timezone: true,
      currency: true,
      country: true,
      bookingHorizonDays: true,
      bookingLeadMinutes: true,
      cancellationNoticeMinutes: true,
      rescheduleNoticeMinutes: true,
      services: {
        where: { active: true },
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          price: true,
          kind: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
}
