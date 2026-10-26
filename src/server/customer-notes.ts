import "server-only";
import { z } from "zod";
import { requireTenant } from "./authorization";
import { rateLimit } from "./rate-limit";
import {
  insertCustomerNote,
  readCustomerNotes,
} from "./repositories/customer-notes";
export const customerNoteSchema = z.object({
  customerId: z.string().cuid(),
  body: z
    .string()
    .trim()
    .min(1, "Enter a note.")
    .max(2000, "Use at most 2,000 characters."),
});
export async function customerNotes(businessId: string, customerId: string) {
  const scope = await requireTenant(businessId, true);
  const id = z.string().cuid().parse(customerId);
  return readCustomerNotes(scope.context, id);
}
export async function addCustomerNoteService(
  businessId: string,
  input: unknown,
) {
  const scope = await requireTenant(businessId, true);
  const parsed = customerNoteSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check your note." };
  try {
    await rateLimit(`customer-note:${scope.user.id}`, 30, 60);
    await insertCustomerNote(
      scope.context,
      parsed.data.customerId,
      parsed.data.body,
    );
    return { success: "Note added." };
  } catch {
    return { error: "Unable to add this note. Please try again." };
  }
}
