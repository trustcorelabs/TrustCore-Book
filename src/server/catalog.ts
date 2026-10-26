import "server-only";
import { z } from "zod";
import { persistBookingPolicy, persistCategory } from "./repositories/catalog";
import { bookingPolicySchema } from "@/lib/validation";
import { requireTenant } from "./authorization";
import { rateLimit } from "./rate-limit";
export async function saveBookingPolicy(businessId: string, input: unknown) {
  const { context, user } = await requireTenant(businessId, true);
  const data = bookingPolicySchema.safeParse(input);
  if (!data.success)
    return {
      error: "Use valid notice periods and a booking horizon of 1–180 days.",
    };
  try {
    await rateLimit(`catalog-policy:${user.id}`, 30, 60);
    await persistBookingPolicy(context, data.data);
    return { success: "Booking policy saved." };
  } catch {
    return { error: "Unable to save booking policy." };
  }
}
const categorySchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(2).max(60),
});
export async function saveCategory(businessId: string, input: unknown) {
  const { context, user } = await requireTenant(businessId, true);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success)
    return { error: "Enter a category name of 2–60 characters." };
  try {
    await rateLimit(`category-write:${user.id}`, 30, 60);
    await persistCategory(context, parsed.data);
    return { success: "Category saved." };
  } catch {
    return {
      error:
        "Unable to save. Category names must be unique within this workspace.",
    };
  }
}
