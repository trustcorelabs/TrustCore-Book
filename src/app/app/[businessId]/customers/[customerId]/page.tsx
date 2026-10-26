import { customerNotes } from "@/server/customer-notes";
import { CustomerNoteForm } from "@/features/customers/note-form";
import { localTime } from "@/lib/utils";
import { vocabularyFor } from "@/features/industries/presets";
import { customerHistory } from "@/server/insights";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { AppointmentList } from "@/components/appointment-list";
import { canManage } from "@/lib/validation";
export default async function Page({
  params,
}: {
  params: Promise<{ businessId: string; customerId: string }>;
}) {
  const { businessId, customerId } = await params;
  const { scope, customer: c } = await customerHistory(businessId, customerId);
  const manage = canManage(scope.member.role);
  const notes = manage ? await customerNotes(businessId, customerId) : [];
  const words = vocabularyFor(scope.business);
  return (
    <>
      <PageHeading
        title={c.name}
        description={`${words.customer} profile and recorded appointment history.`}
      />
      <Card className="mb-6">
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="mt-2">{c.email ?? "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd className="mt-2">{c.phone ?? "Not provided"}</dd>
          </div>
        </dl>
        <p className="mt-5 text-xs text-muted-foreground">
          Appointment emails:{" "}
          {c.appointmentEmailOptIn ? "Opted in" : "Not opted in"}. This does not
          grant marketing consent.
        </p>
      </Card>
      {manage && (
        <Card className="mb-6">
          <h2 className="text-lg font-semibold">Private service notes</h2>
          <CustomerNoteForm businessId={businessId} customerId={customerId} />
          {notes.length ? (
            <ol className="mt-6 divide-y divide-border">
              {notes.slice(0, 50).map((note) => (
                <li key={note.id} className="py-4">
                  <p className="whitespace-pre-wrap text-sm leading-7">
                    {note.body}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {note.author?.name ?? "Former team member"} ·{" "}
                    {localTime(note.createdAt, scope.business.timezone)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              No service notes yet.
            </p>
          )}
          {notes.length > 50 && (
            <p className="notice mt-4">Showing the latest 50 notes.</p>
          )}
        </Card>
      )}
      {c.appointments.length > 100 && (
        <p className="notice mb-5">Showing the latest 100 visits.</p>
      )}
      <AppointmentList
        businessId={businessId}
        timezone={scope.business.timezone}
        manage={canManage(scope.member.role)}
        appointments={c.appointments.slice(0, 100).map((a) => ({
          ...a,
          startsAt: a.startsAt.toISOString(),
          endsAt: a.endsAt.toISOString(),
          customer: c.name,
          service: a.serviceNameSnapshot ?? a.service.name,
          staff: a.staff.name,
        }))}
      />
    </>
  );
}
export const dynamic = "force-dynamic";
