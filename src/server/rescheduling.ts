import "server-only";
import { z } from "zod";
import { requireTenant } from "./authorization";
import { rescheduleAppointment } from "./repositories/rescheduling";
import { rateLimit } from "./rate-limit";
const schema = z.object({
  id: z.string().cuid(),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export async function rescheduleAppointmentService(
  businessId: string,
  input: unknown,
) {
  if (process.env.BOOKING_MVP_ENABLED !== "true")
    return { error: "Rescheduling is not enabled." };
  const scope = await requireTenant(businessId, true);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Choose a valid local date and time." };
  try {
    await rateLimit(`appointment-move:${scope.user.id}`, 30, 60);
    await rescheduleAppointment(
      scope.context,
      parsed.data.id,
      parsed.data.date,
      parsed.data.time,
    );
    return { success: "Appointment rescheduled." };
  } catch {
    return {
      error:
        "Unable to move this appointment. Check working hours, time off and existing bookings. The business notice policy applies; ambiguous daylight-saving times are not accepted.",
    };
  }
}
