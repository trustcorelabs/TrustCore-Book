import { notificationData } from "@/server/billing";
import { PageHeading } from "@/components/ui/page-heading";
import { DataTable } from "@/components/data-table";
export default async function Page({ params }: { params: Promise<{ businessId: string }> }) {
  const d = await notificationData((await params).businessId);
  return <><PageHeading title="Appointment notifications" description="Delivery status for the latest 100 workspace jobs. Only opted-in customers are eligible." /><p className="notice mb-6">{process.env.APPOINTMENT_NOTIFICATIONS_ENABLED === "true" ? "Queue enabled." : "Queue disabled."} {process.env.APPOINTMENT_EMAIL_DELIVERY_ENABLED === "true" ? "Delivery requires a configured provider and a separately scheduled worker." : "Email delivery disabled. No messages are sent."}</p><DataTable columns={[{ key: "kind", label: "Message" },{ key: "state", label: "Status" },{ key: "attempts", label: "Attempts" },{ key: "scheduled", label: "Scheduled (UTC)" },{ key: "error", label: "Delivery code" }]} rows={d.jobs.map(j => ({ kind: j.kind, state: j.state, attempts: String(j.attempts), scheduled: j.scheduledFor.toISOString(), error: j.errorCode ?? "—" }))} emptyTitle="No notification jobs" emptyDescription="Booking updates can be queued after consent and explicit feature activation. No sample delivery events are shown." /></>;
}
export const dynamic = "force-dynamic";
