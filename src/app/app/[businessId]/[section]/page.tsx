import {
  BookingPolicyForm,
  CategoryManager,
} from "@/components/catalog-settings";
import { SetupGuidance } from "@/features/industries/setup-guidance";
import { vocabularyFor } from "@/features/industries/presets";
import { modules } from "@/features/registry";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { ModuleDirectory } from "@/components/module-directory";
import { requireTenant } from "@/server/authorization";
import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/server/queries";
import { canManage, type businessSchema } from "@/lib/validation";
import { DataTable } from "@/components/data-table";
import { RecordForm } from "@/components/record-form";
import { BusinessForm } from "@/components/business-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
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
    desc: "Your offerings, durations, prices and preparation time.",
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
};
export default async function Page({
  params,
}: {
  params: Promise<{ businessId: string; section: string }>;
}) {
  const { businessId, section } = await params;
  if (section === "analytics") {
    await requireTenant(businessId);
    redirect(`/app/${businessId}/reports`);
  }
  if (!Object.hasOwn(config, section)) {
    const scope = await requireTenant(businessId);
    if (section === "modules")
      return (
        <ModuleDirectory
          businessId={businessId}
          platformAdmin={scope.user.platformAdmin}
          businessSlug={scope.business.slug}
          canManage={canManage(scope.member.role)}
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
  const words = vocabularyFor(business);
  const titles: Record<string, string> = {
    services: `Your ${words.service.toLowerCase()} menu`,
    staff: `Your ${words.team.toLowerCase()}`,
    customers: `Your ${words.customers.toLowerCase()}`,
  };
  const count = key === "settings" ? null : data[key].length;
  return (
    <>
      <PageHeading
        title={titles[key] ?? config[key].title}
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
                businessType: business.businessType as z.infer<
                  typeof businessSchema
                >["businessType"],
                terminologyMode: business.terminologyMode as z.infer<
                  typeof businessSchema
                >["terminologyMode"],
                name: business.name,
                slug: business.slug,
                country: business.country as z.infer<
                  typeof businessSchema
                >["country"],
                timezone: business.timezone,
              }}
            />
            {manage && (
              <BookingPolicyForm businessId={businessId} policy={business} />
            )}
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
      ) : key === "appointments" ? (
        <AppointmentList
          businessId={businessId}
          timezone={business.timezone}
          manage={manage}
          appointments={data.appointments.map((a) => ({
            id: a.id,
            customer: a.customer.name,
            service: a.serviceNameSnapshot ?? a.service.name,
            staff: a.staff.name,
            startsAt: a.startsAt.toISOString(),
            endsAt: a.endsAt.toISOString(),
            status: a.status,
          }))}
        />
      ) : (
        <>
          {manage && key === "services" && !data.services.length && (
            <SetupGuidance business={business} />
          )}
          {manage && key === "services" && (
            <CategoryManager
              businessId={businessId}
              categories={data.categories}
            />
          )}
          {manage && (
            <RecordForm
              businessId={businessId}
              kind={key}
              categories={data.categories}
              catalog={data.services}
              currency={business.currency}
            />
          )}
          {key === "services" &&
            (data.services.length ? (
              <ServiceEditor
                readOnly={!manage}
                businessId={businessId}
                currency={business.currency}
                categories={data.categories}
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
                    ? `Add your first ${words.service.toLowerCase()} with a name, duration and price using the form above.`
                    : `Your business owner can add ${words.services.toLowerCase()} to this menu.`
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
                  bufferBeforeMinutes: p.bufferBeforeMinutes,
                  bufferAfterMinutes: p.bufferAfterMinutes,
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
                    ? `Add a ${words.provider.toLowerCase()} above, then assign ${words.services.toLowerCase()} and working hours.`
                    : `Your business owner can introduce your ${words.team.toLowerCase()} to this workspace.`
                }
              />
            ))}
          {key === "customers" && (
            <DataTable
              columns={[
                { key: "name", label: words.customer, hrefKey: "profileUrl" },
                { key: "email", label: "Email address" },
                { key: "phone", label: "Phone number" },
              ]}
              rows={data.customers.map((c) => ({
                name: c.name,
                profileUrl: `/app/${businessId}/customers/${c.id}`,
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
