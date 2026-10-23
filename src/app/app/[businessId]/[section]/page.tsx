import { modules } from "@/features/registry";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { ModuleDirectory } from "@/components/module-directory";
import { requireTenant } from "@/server/authorization";
import { notFound } from "next/navigation";
import { getWorkspace } from "@/server/queries";
import { canManage, type businessSchema } from "@/lib/validation";
import { DataTable } from "@/components/data-table";
import { RecordForm } from "@/components/record-form";
import { BusinessForm } from "@/components/business-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { ActivityOverview } from "@/components/activity-overview";
import { AppointmentList } from "@/components/appointment-list";
import type { z } from "zod";
import { StaffEditor } from "@/features/staff/staff-editor";
import { ServiceEditor } from "@/features/services/service-editor";
import { businessLocalDate } from "@/features/booking-engine/slots";
const config = {
  appointments: {
    title: "Appointments",
    desc: "Every appointment, beautifully organized. Find the details and keep your day moving.",
  },
  services: {
    title: "Your service menu",
    desc: "The craft, care and expertise that make your business yours.",
  },
  staff: {
    title: "Meet your team",
    desc: "Great people, connected. Manage profiles, services and working hours.",
  },
  customers: {
    title: "Your customers",
    desc: "Keep the people behind your business close, one relationship at a time.",
  },
  settings: {
    title: "Business settings",
    desc: "The essentials that keep your workspace running your way.",
  },
  analytics: {
    title: "Activity insights",
    desc: "A clear picture of recorded appointment activity. Real records, no guesswork.",
  },
};
export default async function Page({
  params,
}: {
  params: Promise<{ businessId: string; section: string }>;
}) {
  const { businessId, section } = await params;
  if (!Object.hasOwn(config, section)) {
    const scope = await requireTenant(businessId);
    if (section === "modules")
      return (
        <ModuleDirectory
          businessId={businessId}
          platformAdmin={scope.user.platformAdmin}
        />
      );
    const feature = modules.find((m) => m.route === section);
    if (!feature) notFound();
    return <ModulePlaceholder module={feature} />;
  }
  const key = section as keyof typeof config;
  const data = await getWorkspace(businessId);
  const { business, member } = data;
  const manage = canManage(member.role);
  const count =
    key === "analytics" || key === "settings" ? null : data[key].length;
  return (
    <>
      <PageHeading
        title={config[key].title}
        description={config[key].desc}
        action={
          count !== null ? (
            <Badge
              tone={
                key === "services"
                  ? "pink"
                  : key === "staff"
                    ? "teal"
                    : key === "customers"
                      ? "amber"
                      : "sky"
              }
            >
              {count}{" "}
              {key === "staff"
                ? "staff profiles"
                : key === "services"
                  ? "services"
                  : key}
            </Badge>
          ) : undefined
        }
      />
      {key === "settings" ? (
        <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <h2 className="mb-2 text-lg font-bold">Business profile</h2>
            <p className="mb-7 text-sm text-muted-foreground">
              {manage
                ? "Make sure your customers always have the right details."
                : "An owner or admin can update these settings."}
            </p>
            <BusinessForm
              businessId={businessId}
              readOnly={!manage}
              initial={{
                name: business.name,
                slug: business.slug,
                country: business.country as z.infer<
                  typeof businessSchema
                >["country"],
                timezone: business.timezone,
              }}
            />
          </Card>
          <Card className="bg-sky-soft">
            <Badge tone="sky">Regional preferences</Badge>
            <h2 className="mt-4 text-lg font-bold">A local touch</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Your workspace uses {business.timezone} and prices in{" "}
              {business.currency}. Country changes require support once your
              business is created.
            </p>
          </Card>
        </div>
      ) : key === "analytics" ? (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <ActivityOverview statuses={data.appointments.map((a) => a.status)} />
          <Card>
            <Badge tone="sky">About these insights</Badge>
            <h2 className="mt-4 text-lg font-bold">
              Your records, made clearer
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              This view summarizes up to the 100 most recent recorded
              appointments. Counts represent appointment statuses, with no
              inferred revenue or growth estimates. Full historical and
              financial analytics are not available yet.
            </p>
          </Card>
        </div>
      ) : key === "appointments" ? (
        <AppointmentList
          businessId={businessId}
          timezone={business.timezone}
          manage={manage}
          appointments={data.appointments.map((a) => ({
            id: a.id,
            customer: a.customer.name,
            service: a.service.name,
            staff: a.staff.name,
            startsAt: a.startsAt.toISOString(),
            endsAt: a.endsAt.toISOString(),
            status: a.status,
          }))}
        />
      ) : (
        <>
          {manage && (
            <RecordForm
              businessId={businessId}
              kind={key}
              currency={business.currency}
            />
          )}
          {key === "services" &&
            (data.services.length ? (
              <ServiceEditor
                readOnly={!manage}
                businessId={businessId}
                currency={business.currency}
                services={data.services.map((s) => ({
                  ...s,
                  price: s.price.toString(),
                }))}
              />
            ) : (
              <EmptyState
                title="Make room for your craft"
                description={
                  manage
                    ? "Add your first service with a name, duration and price using the form above."
                    : "Your business owner can add services to this menu."
                }
              />
            ))}
          {key === "staff" &&
            (data.staff.length ? (
              <StaffEditor
                readOnly={!manage}
                businessId={businessId}
                staff={data.staff.map((p) => ({
                  id: p.id,
                  name: p.name,
                  active: p.active,
                  serviceIds: p.services.map((r) => r.serviceId),
                  rules: p.availability.map((r) => ({
                    weekday: r.weekday,
                    startMinute: r.startMinute,
                    endMinute: r.endMinute,
                  })),
                  timeOff: p.exceptions.map((e) => ({
                    id: e.id,
                    startsAt: e.startsAt.toISOString(),
                    endsAt: e.endsAt.toISOString(),
                  })),
                }))}
                services={data.services.map((s) => ({
                  id: s.id,
                  name: s.name,
                  active: s.active,
                }))}
                timezone={business.timezone}
                today={businessLocalDate(new Date(), business.timezone)}
              />
            ) : (
              <EmptyState
                title="Good work starts with great people"
                description={
                  manage
                    ? "Add a staff member above, then assign services and working hours."
                    : "Your business owner can introduce staff to this workspace."
                }
              />
            ))}
          {key === "customers" && (
            <DataTable
              columns={[
                { key: "name", label: "Customer" },
                { key: "email", label: "Email address" },
                { key: "phone", label: "Phone number" },
              ]}
              rows={data.customers.map((c) => ({
                name: c.name,
                email: c.email ?? "—",
                phone: c.phone ?? "—",
              }))}
              emptyTitle="Every relationship starts somewhere"
              emptyDescription={
                manage
                  ? "Use the form above to add your first customer. Their contact details will live here."
                  : "Your business owner can add customers to this directory."
              }
            />
          )}
        </>
      )}
      {(key === "customers" || key === "appointments") && (
        <p className="mt-5 text-xs text-muted-foreground">
          Showing up to the 100 most recent records.
        </p>
      )}
    </>
  );
}
