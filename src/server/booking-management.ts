import "server-only";
import { getEnv } from "@/lib/env";
import { z } from "zod";
import { businessLocalDate } from "@/features/booking-engine/slots";
import { noticeAllowed } from "@/features/booking-engine/policy";
import {
  managedRescheduleSlots,
  rescheduleManagedBooking,
} from "./repositories/rescheduling";
import {
  issueRescheduleAuthorization,
  verifyRescheduleAuthorization,
} from "./reschedule-authorization";
import { verifyBookingCapability } from "./booking-management-token";
import {
  changeManagedEmailPreference,
  readManagedBooking,
  cancelManagedBooking,
} from "./repositories/booking-management";
import { rateLimit } from "./rate-limit";
async function capability(token: unknown, clientId: string) {
  if (process.env.BOOKING_MVP_ENABLED !== "true") return null;
  await rateLimit("booking-management:global", 200, 60);
  await rateLimit(`booking-management:${clientId}`, 20, 60);
  return verifyBookingCapability(token, getEnv().NEXTAUTH_SECRET);
}
export async function lookupManagedBooking(token: unknown, clientId: string) {
  try {
    const cap = await capability(token, clientId);
    if (!cap) return { error: "This booking link is unavailable or expired." };
    const a = await readManagedBooking(cap);
    if (!a) return { error: "This booking link is unavailable or expired." };
    return {
      booking: {
        reference: a.id,
        businessName: a.business.name,
        slug: a.business.slug,
        timezone: a.business.timezone,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        status: a.status,
        price: a.price.toString(),
        currency: a.currency,
        emailOptIn: a.customer.appointmentEmailOptIn,
        service: a.serviceNameSnapshot ?? a.service.name,
        cancellationNoticeMinutes: a.business.cancellationNoticeMinutes,
        rescheduleNoticeMinutes: a.business.rescheduleNoticeMinutes,
        canReschedule:
          ["PENDING", "CONFIRMED"].includes(a.status) &&
          noticeAllowed(
            a.startsAt,
            new Date(),
            a.business.rescheduleNoticeMinutes,
          ),
        staff: a.staff.name,
        canCancel:
          ["PENDING", "CONFIRMED"].includes(a.status) &&
          noticeAllowed(
            a.startsAt,
            new Date(),
            a.business.cancellationNoticeMinutes,
          ),
      },
    };
  } catch {
    return {
      error:
        "Booking details are temporarily unavailable. Please contact the business.",
    };
  }
}
export async function cancelCustomerBooking(token: unknown, clientId: string) {
  try {
    const cap = await capability(token, clientId);
    if (!cap) return { error: "This booking link is unavailable or expired." };
    await cancelManagedBooking(cap);
    return { success: "Your appointment is cancelled." };
  } catch {
    return {
      error:
        "Unable to cancel. Check the business cancellation policy or contact the business.",
    };
  }
}

const moveSchema = z.object({
  startsAt: z.iso.datetime({ offset: true }),
  authorization: z.string().max(1400),
});
export async function customerRescheduleSlots(
  token: unknown,
  date: unknown,
  clientId: string,
) {
  try {
    const cap = await capability(token, clientId);
    const day = z.iso.date().parse(date);
    if (!cap) throw Error("Invalid link");
    const from = new Date(Date.parse(day + "T00:00:00Z") - 86400000),
      to = new Date(Date.parse(day + "T00:00:00Z") + 2 * 86400000);
    const data = await managedRescheduleSlots(cap, from, to);
    return {
      authorization: issueRescheduleAuthorization(
        cap,
        data.expectedStartsAt,
        getEnv().NEXTAUTH_SECRET,
      ),
      slots: data.slots.filter(
        (s) => businessLocalDate(new Date(s.startsAt), data.timezone) === day,
      ),
    };
  } catch {
    return {
      error:
        "Unable to find times. Check the date, booking policy and link expiry.",
    };
  }
}
export async function rescheduleCustomerBooking(
  token: unknown,
  input: unknown,
  clientId: string,
) {
  try {
    const cap = await capability(token, clientId);
    const move = moveSchema.parse(input);
    if (!cap) throw Error("Invalid link");
    const grant = verifyRescheduleAuthorization(
      move.authorization,
      cap,
      getEnv().NEXTAUTH_SECRET,
    );
    if (!grant) throw Error("Reschedule authorization expired");
    await rescheduleManagedBooking(
      { ...cap, expiresAt: grant.expiresAt },
      {
        startsAt: move.startsAt,
        expectedStartsAt: grant.expectedStartsAt,
        operationKey: grant.operationKey,
      },
    );
    return { success: "Your appointment is rescheduled." };
  } catch {
    return {
      error:
        "Unable to reschedule. The booking or availability may have changed. Refresh times before trying again.",
    };
  }
}

export async function updateCustomerNotificationPreference(
  token: unknown,
  enabled: unknown,
  clientId: string,
) {
  try {
    const cap = await capability(token, clientId);
    if (!cap || typeof enabled !== "boolean") throw Error("Invalid request");
    await changeManagedEmailPreference(cap, enabled);
    return { success: "Email preference saved." };
  } catch {
    return { error: "Unable to update preferences. Check your booking link." };
  }
}
