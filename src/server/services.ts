import "server-only";
import { compare, hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import {
  createCredentialsUser,
  createAccountSecurityToken,
  findUserForEmail,
  hasRedeemableResetToken,
  redeemVerificationToken,
  redeemResetToken,
  findOwnPassword,
  listOwnSessions,
  replaceOwnPasswordAndRevokeSessions,
  revokeAllOwnSessions,
  revokeOwnSession,
  updateOwnName,
} from "./repositories/identity";
import {
  createOwnedBusiness,
  insertRecord,
  updateProfile,
  updateCatalogRecord,
  replaceStaffSchedule,
  transitionAppointment,
  createStaffTimeOff,
  removeStaffTimeOff,
} from "./repositories/workspace";
import {
  businessSchema,
  customerSchema,
  registerSchema,
  profileSchema,
  passwordChangeSchema,
  serviceSchema,
  staffSchema,
  serviceEditSchema,
  staffEditSchema,
  staffScheduleSchema,
  accountEmailSchema,
  resetPasswordSchema,
} from "@/lib/validation";
import { issueAccountToken, digestAccountToken } from "./account-tokens";
import { accountEmailDelivery } from "./account-email";
import { localOutboxTarget } from "./local-outbox-target";
import { getEnv } from "@/lib/env";
import { resolveBusinessLocalTime } from "@/features/booking-engine/slots";
import {
  requireTenant,
  requireUser,
  requireUserSession,
} from "./authorization";
import { rateLimit, RateLimitExceededError } from "./rate-limit";
export type ActionResult = { error?: string; success?: string };
function emailDeliveryUnavailable() {
  if (process.env.NODE_ENV !== "development")
    return "Account email delivery is unavailable. Please try again later.";
  if (
    !process.env.ACCOUNT_EMAIL_PROVIDER ||
    process.env.ACCOUNT_EMAIL_PROVIDER === "local"
  ) {
    const required = [
      "ACCOUNT_EMAIL_PROVIDER",
      "LOCAL_OUTBOX_ENABLED",
      "LOCAL_OUTBOX_TARGET_APPROVED",
      "LOCAL_OUTBOX_EXPECTED_ENDPOINT",
      "LOCAL_OUTBOX_EXPECTED_DATABASE",
      "LOCAL_OUTBOX_NEON_PROJECT_ID",
      "LOCAL_OUTBOX_NEON_BRANCH_ID",
      "LOCAL_OUTBOX_NEON_BRANCH_NAME",
      "LOCAL_OUTBOX_NEON_API_KEY",
      "LOCAL_OUTBOX_ACCESS_TOKEN",
      "DATABASE_URL",
      "NEXTAUTH_URL",
    ] as const;
    const missing = required.find((name) => !process.env[name]);
    return missing
      ? `Local email outbox is unavailable: set ${missing}. See docs/LOCAL_DEVELOPMENT_INTEGRATIONS.md.`
      : "Local email outbox could not verify the disposable database. Check docs/LOCAL_DEVELOPMENT_INTEGRATIONS.md.";
  }
  return "Account email delivery is unavailable. Check the configured development email provider.";
}
export async function registerAccountService(
  input: unknown,
): Promise<ActionResult> {
  const result = registerSchema.safeParse(input);
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Check your details." };
  try {
    await rateLimit("registration:global", 100);
    await rateLimit(`register:${result.data.email}`, 5);
    const passwordHash = await hash(result.data.password, 12);
    await createCredentialsUser({
      name: result.data.name,
      email: result.data.email,
      passwordHash,
    });
    return { success: REGISTRATION_MESSAGE };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { success: REGISTRATION_MESSAGE };
    return {
      error:
        error instanceof RateLimitExceededError
          ? "Too many attempts. Please try again later."
          : registrationFailureMessage(error),
    };
  }
}
function registrationFailureMessage(error: unknown) {
  const unavailable =
    "Registration is temporarily unavailable. Please try again later.";
  if (process.env.NODE_ENV !== "development") return unavailable;
  if (
    error instanceof Error &&
    error.message === "Server environment is incomplete. See .env.example."
  )
    return "Local server configuration is incomplete. Check the required settings in .env.example.";
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  if (
    code === "P2021" ||
    code === "P2022" ||
    code === "42P01" ||
    code === "42703"
  )
    return "The development database is missing required tables or columns. Check migration status on the verified disposable branch.";
  if (
    code === "P1000" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1011" ||
    code === "P1017" ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "28P01" ||
    code === "3D000"
  )
    return "The development database connection failed. Check the verified disposable branch, endpoint, credentials and network access.";
  return "Local registration failed. Check the verified development database connection and migration status.";
}
function accountLink(path: string, token: string) {
  const url = new URL(path, getEnv().NEXTAUTH_URL);
  url.hash = `token=${token}`;
  return url.toString();
}
function accountLinksReady() {
  try {
    const url = new URL(getEnv().NEXTAUTH_URL);
    if (process.env.ACCOUNT_EMAIL_PROVIDER === "local") {
      const target = localOutboxTarget(process.env);
      return !!target && url.origin === target.origin;
    }
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
const REGISTRATION_MESSAGE =
  "If this address is available, you can sign in with your password.";
const REQUEST_MESSAGE =
  "If eligible and email delivery succeeds, check your inbox for a link.";
function requestMessage() {
  return process.env.ACCOUNT_EMAIL_PROVIDER === "local"
    ? "If eligible and local delivery succeeds, check the development outbox for a link."
    : REQUEST_MESSAGE;
}
export async function requestAccountEmailService(
  kind: "VERIFY_EMAIL" | "RESET_PASSWORD",
  input: unknown,
): Promise<ActionResult> {
  const parsed = accountEmailSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a valid email address." };
  const delivery = accountEmailDelivery();
  if (!delivery.configured)
    return {
      error: emailDeliveryUnavailable(),
    };
  if (!accountLinksReady())
    return {
      error: "Secure account links are unavailable. Please try again later.",
    };
  try {
    await rateLimit(`${kind.toLowerCase()}:global`, 100);
    await rateLimit(`${kind.toLowerCase()}:${parsed.data.email}`, 5);
    if (delivery.preflight && !(await delivery.preflight()))
      return {
        error: emailDeliveryUnavailable(),
      };
    const user = await findUserForEmail(parsed.data.email);
    if (
      user &&
      (kind === "RESET_PASSWORD" ||
        (user.emailVerificationRequired && !user.emailVerifiedAt))
    ) {
      const token = issueAccountToken(
        kind,
        kind === "RESET_PASSWORD" ? 30 : 60,
      );
      await createAccountSecurityToken({
        userId: user.id,
        purpose: kind,
        digest: token.digest,
        expiresAt: token.expiresAt,
      });
      await delivery.send({
        kind,
        recipient: user.email,
        link: accountLink(
          kind === "VERIFY_EMAIL" ? "/verify-email" : "/reset-password",
          token.token,
        ),
      });
    }
    return { success: requestMessage() };
  } catch (error) {
    return {
      error:
        error instanceof RateLimitExceededError
          ? "Too many attempts. Please try again later."
          : "Account request is temporarily unavailable. Please try again later.",
    };
  }
}
export async function verifyEmailService(
  input: unknown,
): Promise<ActionResult> {
  if (typeof input !== "string") return { error: "Invalid or expired link." };
  const digest = digestAccountToken("VERIFY_EMAIL", input);
  if (!digest) return { error: "Invalid or expired link." };
  try {
    await rateLimit("verify-redeem:global", 100);
    await rateLimit(`verify-redeem:${digest}`, 10);
    return (await redeemVerificationToken(digest))
      ? { success: "Email verified. You can sign in." }
      : { error: "Invalid or expired link." };
  } catch {
    return { error: "Verification is temporarily unavailable." };
  }
}
export async function resetPasswordService(
  input: unknown,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the link and new password." };
  const digest = digestAccountToken("RESET_PASSWORD", parsed.data.token)!;
  try {
    await rateLimit("reset-redeem:global", 100);
    await rateLimit(`reset-redeem:${digest}`, 10);
    if (!(await hasRedeemableResetToken(digest)))
      return { error: "Invalid or expired link." };
    const passwordHash = await hash(parsed.data.password, 12);
    return (await redeemResetToken(digest, passwordHash))
      ? { success: "Password updated. Sign in again." }
      : { error: "Invalid or expired link." };
  } catch {
    return { error: "Password reset is temporarily unavailable." };
  }
}
export async function getOwnAccountService() {
  const session = await requireUserSession();
  const sessions = await listOwnSessions(
    session.userId,
    session.user.credentialVersion,
  );
  const visibleSessions = sessions.some((row) => row.id === session.id)
    ? sessions
    : [session, ...sessions.slice(0, 99)];
  return {
    profile: {
      name: session.user.name,
      email: session.user.email,
      createdAt: session.user.createdAt.toISOString(),
    },
    sessions: visibleSessions.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      current: row.id === session.id,
    })),
  };
}
export async function updateOwnProfileService(
  input: unknown,
): Promise<ActionResult> {
  const session = await requireUserSession();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Enter a name between 2 and 100 characters." };
  try {
    await rateLimit(`profile:${session.userId}`, 20, 60);
    await updateOwnName(session.userId, parsed.data.name);
    return { success: "Profile updated." };
  } catch {
    return { error: "Unable to update profile. Please try again later." };
  }
}
export async function revokeOwnSessionService(
  id: unknown,
): Promise<ActionResult & { signedOut?: boolean }> {
  const session = await requireUserSession();
  if (typeof id !== "string" || id.length < 1 || id.length > 128)
    return { error: "Invalid session." };
  try {
    await rateLimit(`sessions:${session.userId}`, 30, 60);
    await revokeOwnSession(session.userId, id);
    return { success: "Session revoked.", signedOut: id === session.id };
  } catch {
    return { error: "Unable to revoke session. Please try again later." };
  }
}
export async function revokeAllOwnSessionsService(): Promise<
  ActionResult & { signedOut?: boolean }
> {
  const session = await requireUserSession();
  try {
    await rateLimit(`sessions:${session.userId}`, 30, 60);
    await revokeAllOwnSessions(session.userId);
    return { success: "All sessions revoked.", signedOut: true };
  } catch {
    return { error: "Unable to revoke sessions. Please try again later." };
  }
}
export async function changeOwnPasswordService(
  input: unknown,
): Promise<ActionResult & { signedOut?: boolean }> {
  const session = await requireUserSession();
  const parsed = passwordChangeSchema.safeParse(input);
  if (!parsed.success) return { error: "Check your password details." };
  try {
    await rateLimit(`password-change:${session.userId}`, 5);
    const existing = await findOwnPassword(session.userId);
    if (
      !existing ||
      !(await compare(parsed.data.currentPassword, existing.passwordHash))
    )
      return { error: "Current password is incorrect." };
    if (await compare(parsed.data.newPassword, existing.passwordHash))
      return { error: "Choose a different password." };
    const nextHash = await hash(parsed.data.newPassword, 12);
    const changed = await replaceOwnPasswordAndRevokeSessions(
      session.userId,
      existing.passwordHash,
      nextHash,
    );
    if (!changed) return { error: "Password changed elsewhere. Please retry." };
    return { success: "Password changed. Sign in again.", signedOut: true };
  } catch {
    return { error: "Unable to change password. Please try again later." };
  }
}
export async function createBusinessService(
  input: unknown,
): Promise<ActionResult & { businessId?: string }> {
  const user = await requireUser();
  if (user.emailVerificationRequired && !user.emailVerifiedAt)
    return { error: "Verify your email before creating a business." };
  const result = businessSchema.safeParse(input);
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Check your details." };
  let id: string;
  try {
    await rateLimit(`onboard:${user.id}`, 5);
    const business = await createOwnedBusiness(user.id, result.data);
    id = business.id;
  } catch (error) {
    if (error instanceof RateLimitExceededError)
      return { error: "Too many attempts. Please try again later." };
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return {
        error:
          "This booking address is already taken. Go back and choose a different booking address.",
      };
    return {
      error: "Unable to create this business. Please try again later.",
    };
  }
  return { businessId: id };
}
export async function createRecordService(
  businessId: string,
  kind: "services" | "staff" | "customers",
  input: unknown,
): Promise<ActionResult> {
  const { user, context } = await requireTenant(businessId, true);
  const schema =
    kind === "services"
      ? serviceSchema
      : kind === "staff"
        ? staffSchema
        : kind === "customers"
          ? customerSchema
          : null;
  if (!schema) return { error: "Unknown record type." };
  const result = schema.safeParse(input);
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Check your details." };
  try {
    await rateLimit(`write:${user.id}`, 60, 60);
    if (kind === "services")
      await insertRecord(context, { kind, input: serviceSchema.parse(input) });
    else if (kind === "staff")
      await insertRecord(context, { kind, input: staffSchema.parse(input) });
    else
      await insertRecord(context, { kind, input: customerSchema.parse(input) });
  } catch {
    return { error: "Unable to save. Please try again." };
  }
  return { success: "Saved successfully." };
}
export async function updateBusinessService(
  businessId: string,
  input: unknown,
): Promise<ActionResult> {
  const { user, business, context } = await requireTenant(businessId, true);
  const result = businessSchema.safeParse(input);
  if (!result.success)
    return { error: result.error.issues[0]?.message ?? "Check your details." };
  // Currency changes need a future explicit migration flow once prices exist.
  if (result.data.country !== business.country)
    return { error: "Contact support to change your business country." };
  try {
    await rateLimit(`settings:${user.id}`, 20, 60);
    await updateProfile(context, result.data);
  } catch (error) {
    return {
      error:
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
          ? "That booking address is already in use."
          : "Unable to save settings.",
    };
  }
  return { success: "Business settings updated." };
}
export async function editCatalogRecordService(
  businessId: string,
  kind: "services" | "staff",
  input: unknown,
): Promise<ActionResult> {
  const { user, context } = await requireTenant(businessId, true);
  const parsed = (
    kind === "services" ? serviceEditSchema : staffEditSchema
  ).safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check the record." };
  try {
    await rateLimit(`write:${user.id}`, 60, 60);
    if (kind === "services")
      await updateCatalogRecord(context, {
        kind,
        input: serviceEditSchema.parse(input),
      });
    else
      await updateCatalogRecord(context, {
        kind,
        input: staffEditSchema.parse(input),
      });
    return { success: "Changes saved." };
  } catch {
    return { error: "Unable to update this record." };
  }
}
export async function saveStaffScheduleService(
  businessId: string,
  input: unknown,
): Promise<ActionResult> {
  const { user, context } = await requireTenant(businessId, true);
  const parsed = staffScheduleSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Check staff hours and assigned services." };
  try {
    await rateLimit(`write:${user.id}`, 60, 60);
    await replaceStaffSchedule(context, parsed.data);
    return { success: "Schedule saved." };
  } catch {
    return { error: "Unable to save this schedule." };
  }
}
export async function changeAppointmentStatusService(
  businessId: string,
  id: unknown,
  status: unknown,
): Promise<ActionResult> {
  const { user, context } = await requireTenant(businessId, true);
  if (
    typeof id !== "string" ||
    !/^[a-z0-9]{15,40}$/.test(id) ||
    (status !== "CONFIRMED" &&
      status !== "CANCELLED" &&
      status !== "COMPLETED" &&
      status !== "NO_SHOW")
  )
    return { error: "Invalid appointment change." };
  try {
    await rateLimit(`write:${user.id}`, 60, 60);
    await transitionAppointment(context, id, status);
    return { success: "Appointment updated." };
  } catch {
    return { error: "Unable to update this appointment." };
  }
}
const timeOffSchema = z.object({
  staffId: z.string().cuid(),
  startDate: z.iso.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endDate: z.iso.date(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export async function addStaffTimeOffService(
  businessId: string,
  input: unknown,
): Promise<ActionResult> {
  const { user, business, context } = await requireTenant(businessId, true);
  const parsed = timeOffSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the time-off dates and hours." };
  const { staffId, startDate, startTime, endDate, endTime } = parsed.data;
  const startsAt = resolveBusinessLocalTime(
    startDate,
    startTime,
    business.timezone,
  );
  const endsAt = resolveBusinessLocalTime(endDate, endTime, business.timezone);
  if (!startsAt || !endsAt)
    return {
      error:
        "This local time is invalid or ambiguous in the business timezone.",
    };
  if (
    startsAt < new Date() ||
    endsAt <= startsAt ||
    endsAt.getTime() - startsAt.getTime() > 7 * 86400_000
  )
    return {
      error: "Choose a future time-off interval of no more than seven days.",
    };
  try {
    await rateLimit(`write:${user.id}`, 60, 60);
    await createStaffTimeOff(context, staffId, startsAt, endsAt);
    return { success: "Time off saved." };
  } catch {
    return {
      error: "Unable to save time off. Check for an existing appointment.",
    };
  }
}
export async function removeStaffTimeOffService(
  businessId: string,
  staffId: unknown,
  id: unknown,
): Promise<ActionResult> {
  const { user, context } = await requireTenant(businessId, true);
  if (
    typeof staffId !== "string" ||
    !z.string().cuid().safeParse(staffId).success ||
    typeof id !== "string" ||
    !z.string().cuid().safeParse(id).success
  )
    return { error: "Invalid time off." };
  try {
    await rateLimit(`write:${user.id}`, 60, 60);
    await removeStaffTimeOff(context, staffId, id);
    return { success: "Time off removed." };
  } catch {
    return { error: "Unable to remove time off." };
  }
}
