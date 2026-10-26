"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  registerAccountService,
  createBusinessService,
  createRecordService,
  updateBusinessService,
  editCatalogRecordService,
  saveStaffScheduleService,
  changeAppointmentStatusService,
  addStaffTimeOffService,
  removeStaffTimeOffService,
  updateOwnProfileService,
  revokeOwnSessionService,
  revokeAllOwnSessionsService,
  changeOwnPasswordService,
  requestAccountEmailService,
  verifyEmailService,
  resetPasswordService,
} from "./services";
import type { ActionResult } from "./services";
import { getPublicSlots, createPublicBooking } from "./public-booking";
import { bookingClientId } from "./anonymous-booking";
import {
  inviteMember,
  cancelInvitation,
  respondToInvitation,
  setMemberRole,
  removeMember,
  transferBusinessOwnership,
} from "./membership";
export type { ActionResult } from "./services";
export async function rescheduleRecordedAppointment(
  businessId: string,
  input: unknown,
) {
  const { rescheduleAppointmentService } = await import("./rescheduling");
  const result = await rescheduleAppointmentService(businessId, input);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}
export async function lookupBooking(token: unknown) {
  const { lookupManagedBooking } = await import("./booking-management");
  return lookupManagedBooking(token, await bookingClientId());
}
export async function cancelBookingByLink(token: unknown) {
  const { cancelCustomerBooking } = await import("./booking-management");
  return cancelCustomerBooking(token, await bookingClientId());
}
export async function loadPublicSlots(input: unknown) {
  return getPublicSlots(input, await bookingClientId());
}
export async function submitPublicBooking(input: unknown) {
  return createPublicBooking(input, await bookingClientId());
}
export async function register(input: unknown): Promise<ActionResult> {
  return registerAccountService(input);
}
export async function resendVerification(input: unknown) {
  return requestAccountEmailService("VERIFY_EMAIL", input);
}
export async function forgotPassword(input: unknown) {
  return requestAccountEmailService("RESET_PASSWORD", input);
}
export async function verifyEmail(token: string) {
  return verifyEmailService(token);
}
export async function resetPassword(input: unknown) {
  return resetPasswordService(input);
}
export async function onboard(input: unknown): Promise<ActionResult> {
  const result = await createBusinessService(input);
  if (result.businessId) redirect(`/app/${result.businessId}`);
  return result;
}
export async function createRecord(
  businessId: string,
  kind: "services" | "staff" | "customers",
  input: unknown,
): Promise<ActionResult> {
  const result = await createRecordService(businessId, kind, input);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}
export async function editCatalogRecord(
  businessId: string,
  kind: "services" | "staff",
  input: unknown,
) {
  const result = await editCatalogRecordService(businessId, kind, input);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}
export async function saveStaffSchedule(businessId: string, input: unknown) {
  const result = await saveStaffScheduleService(businessId, input);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}
export async function changeAppointmentStatus(
  businessId: string,
  id: string,
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW",
) {
  const result = await changeAppointmentStatusService(businessId, id, status);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}
export async function addStaffTimeOff(businessId: string, input: unknown) {
  const result = await addStaffTimeOffService(businessId, input);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}
export async function removeStaffTimeOff(
  businessId: string,
  staffId: string,
  id: string,
) {
  const result = await removeStaffTimeOffService(businessId, staffId, id);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}
export async function updateBusiness(
  businessId: string,
  input: unknown,
): Promise<ActionResult> {
  const result = await updateBusinessService(businessId, input);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}
export async function updateOwnProfile(input: unknown): Promise<ActionResult> {
  const result = await updateOwnProfileService(input);
  if (result.success) revalidatePath("/account");
  return result;
}
export async function revokeOwnSession(id: string) {
  const result = await revokeOwnSessionService(id);
  if (result.success) revalidatePath("/account");
  return result;
}
export async function revokeAllOwnSessions() {
  const result = await revokeAllOwnSessionsService();
  if (result.success) revalidatePath("/account");
  return result;
}
export async function changeOwnPassword(input: unknown) {
  return changeOwnPasswordService(input);
}
export async function sendMemberInvitation(businessId: string, input: unknown) {
  const result = await inviteMember(businessId, input);
  if (result.success) revalidatePath(`/app/${businessId}/members`);
  return result;
}
export async function revokeMemberInvitation(businessId: string, id: string) {
  const result = await cancelInvitation(businessId, id);
  if (result.success) revalidatePath(`/app/${businessId}/members`);
  return result;
}
export async function answerMemberInvitation(token: string, accept: boolean) {
  return respondToInvitation(token, accept);
}
export async function updateMemberRole(businessId: string, input: unknown) {
  const result = await setMemberRole(businessId, input);
  if (result.success) revalidatePath(`/app/${businessId}/members`);
  return result;
}
export async function deleteMember(businessId: string, id: string) {
  const result = await removeMember(businessId, id);
  if (result.success) revalidatePath(`/app/${businessId}/members`);
  return result;
}
export async function handOffOwnership(businessId: string, id: string) {
  const result = await transferBusinessOwnership(businessId, id);
  if (result.success) revalidatePath(`/app/${businessId}/members`);
  return result;
}

export async function loadCustomerRescheduleSlots(
  token: unknown,
  date: unknown,
) {
  const { customerRescheduleSlots } = await import("./booking-management");
  return customerRescheduleSlots(token, date, await bookingClientId());
}
export async function moveCustomerBooking(token: unknown, input: unknown) {
  const { rescheduleCustomerBooking } = await import("./booking-management");
  return rescheduleCustomerBooking(token, input, await bookingClientId());
}
export async function updateBookingPolicy(businessId: string, input: unknown) {
  const { saveBookingPolicy } = await import("./catalog");
  const result = await saveBookingPolicy(businessId, input);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}
export async function updateServiceCategory(
  businessId: string,
  input: unknown,
) {
  const { saveCategory } = await import("./catalog");
  const result = await saveCategory(businessId, input);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}

export async function updateBookingEmailPreference(
  token: unknown,
  enabled: unknown,
) {
  const { updateCustomerNotificationPreference } =
    await import("./booking-management");
  return updateCustomerNotificationPreference(
    token,
    enabled,
    await bookingClientId(),
  );
}
export async function changeBillingTrial(
  businessId: string,
  cancel: boolean,
): Promise<ActionResult> {
  const { changeSandboxTrial } = await import("./billing");
  if (typeof cancel !== "boolean") return { error: "Invalid trial request." };
  const result = await changeSandboxTrial(businessId, cancel);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}

export async function addCustomerNote(businessId: string, input: unknown) {
  const { addCustomerNoteService } = await import("./customer-notes");
  const result = await addCustomerNoteService(businessId, input);
  if (result.success) revalidatePath(`/app/${businessId}`, "layout");
  return result;
}
