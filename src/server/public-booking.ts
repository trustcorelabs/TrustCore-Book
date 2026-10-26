import "server-only";
import { createPublicBooking as persistBooking } from "./repositories/booking";
import { receiptBusiness } from "./repositories/booking-management";
import { issueBookingCapability } from "./booking-management-token";
import { getEnv } from "@/lib/env";
export { getPublicSlots } from "./repositories/booking";
export async function createPublicBooking(input: unknown, clientId: string) {
  const result = await persistBooking(input, clientId);
  if (!result.success || !result.bookingId)
    return { ...result, managementToken: undefined };
  try {
    const slug = (input as { slug?: unknown })?.slug;
    if (typeof slug !== "string")
      return { ...result, managementToken: undefined };
    const row = await receiptBusiness(result.bookingId, slug);
    return {
      ...result,
      managementToken: row
        ? issueBookingCapability(
            row.businessId,
            result.bookingId,
            getEnv().NEXTAUTH_SECRET,
          )
        : undefined,
    };
  } catch {
    return { ...result, managementToken: undefined };
  }
}
