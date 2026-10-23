import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Sparkles,
  Users,
  Contact,
  Check,
  Plus,
  Clock3,
  ArrowUpRight,
} from "lucide-react";
import { getDashboard, getWorkspace } from "@/server/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { PageHeading } from "@/components/ui/page-heading";
import { ActivityOverview } from "@/components/activity-overview";
import { localTime } from "@/lib/utils";
import { canManage } from "@/lib/validation";
export default async function Page({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const [data, workspace] = await Promise.all([
    getDashboard(businessId),
    getWorkspace(businessId),
  ]);
  const { business, user, member, appointments, services, staff, customers } =
    data;
  const manage = canManage(member.role);
  const base = `/app/${businessId}`;
  const setup = [
    {
      title: "Create your service menu",
      text: "Add your services, durations and prices.",
      done: services > 0,
      path: "services",
      tone: "pink",
    },
    {
      title: "Bring your team together",
      text: "Set up staff profiles and working hours.",
      done: staff > 0,
      path: "staff",
      tone: "teal",
    },
    {
      title: "Add your first customer",
      text: "Keep the details behind every relationship.",
      done: customers > 0,
      path: "customers",
      tone: "amber",
    },
  ];
  const done = setup.filter((s) => s.done).length;
  const now = new Date().getTime();
  const upcoming = workspace.appointments
    .filter(
      (a) =>
        a.startsAt.getTime() >= now &&
        ["PENDING", "CONFIRMED"].includes(a.status),
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 5);
  return (
    <>
      <PageHeading
        eyebrow="Your business at a glance"
        title={`Good to see you, ${user.name.split(" ")[0]}.`}
        description={`A little clarity for your day at ${business.name}.`}
        action={
          <Button asChild variant="outline">
            <Link href={`${base}/appointments`}>
              <CalendarDays size={16} />
              View appointments
            </Link>
          </Button>
        }
      />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          {
            title: "Appointments",
            count: appointments,
            icon: CalendarDays,
            path: "appointments",
            note: "All recorded appointments",
            tone: "sky",
          },
          {
            title: "Customers",
            count: customers,
            icon: Contact,
            path: "customers",
            note: "People in your directory",
            tone: "amber",
          },
          {
            title: "Active services",
            count: services,
            icon: Sparkles,
            path: "services",
            note: "Ready in your service menu",
            tone: "pink",
          },
          {
            title: "Active staff",
            count: staff,
            icon: Users,
            path: "staff",
            note: "Your service professionals",
            tone: "teal",
          },
        ].map((item) => (
          <Link
            key={item.title}
            href={`${base}/${item.path}`}
            className="group min-w-0"
          >
            <Card className="relative h-full overflow-hidden p-4 sm:p-6 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/30">
              <div
                className={`absolute inset-x-0 top-0 h-1 tone-${item.tone}`}
              />
              <div className="flex items-center justify-between">
                <span className={`icon-tile tone-${item.tone}`}>
                  <item.icon size={21} />
                </span>
                <ArrowUpRight
                  size={16}
                  className="text-muted-foreground group-hover:text-primary-ink"
                />
              </div>
              <p className="mt-5 text-[2.3rem] font-bold leading-none tracking-tight tabular-nums">
                {item.count}
              </p>
              <p className="mt-3 text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {item.note}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      {done < 3 && (
        <Card className="color-panel mb-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <Badge>Make it yours</Badge>
              <h2 className="mt-3 text-xl font-bold">
                A great business starts with a strong foundation.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {done} of 3 essentials complete. A few small steps, a smoother
                working day.
              </p>
            </div>
            <div className="min-w-36">
              <p className="mb-2 text-right text-xs font-semibold text-primary-ink">
                {Math.round((done / 3) * 100)}% complete
              </p>
              <progress
                aria-label="Business setup progress"
                className="h-2 w-full accent-primary"
                value={done}
                max={3}
              />
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {setup.map((s) => (
              <Link
                key={s.path}
                href={`${base}/${s.path}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/85 p-4"
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full tone-${s.done ? "green" : s.tone}`}
                >
                  {s.done ? <Check size={16} /> : <Plus size={16} />}
                </span>
                <span className="text-xs font-semibold">{s.title}</span>
                <ArrowRight
                  size={14}
                  className="ml-auto shrink-0 text-muted-foreground"
                />
              </Link>
            ))}
          </div>
        </Card>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Upcoming appointments</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  From the latest 100 records · {business.timezone}
                </p>
              </div>
              <Link
                href={`${base}/appointments`}
                className="flex items-center gap-1 text-xs font-semibold text-primary-ink"
              >
                View all
                <ArrowRight size={14} />
              </Link>
            </div>
            {upcoming.length ? (
              <div className="divide-y divide-border">
                {upcoming.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-4 py-4"
                  >
                    <span className="icon-tile tone-sky">
                      <CalendarDays size={19} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold">
                        {a.customer.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.service.name} · {a.staff.name}
                      </p>
                      <p className="mt-2 text-xs font-medium">
                        {localTime(a.startsAt, business.timezone)}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-background px-5 py-10 text-center">
                <span className="icon-tile tone-sky mx-auto mb-4">
                  <CalendarDays size={23} />
                </span>
                <h3 className="text-sm font-semibold">
                  Room for your next great appointment
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-muted-foreground">
                  Upcoming recorded appointments will appear here. Your calendar
                  is clear for now.
                </p>
              </div>
            )}
          </Card>
          <Card>
            <h2 className="mb-5 text-lg font-bold">A little less clicking</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  path: "services",
                  label: manage ? "Manage services" : "Browse services",
                  icon: Sparkles,
                  tone: "pink",
                },
                {
                  path: "staff",
                  label: manage ? "Manage staff" : "View staff",
                  icon: Users,
                  tone: "teal",
                },
                {
                  path: "customers",
                  label: manage ? "Manage customers" : "View customers",
                  icon: Contact,
                  tone: "amber",
                },
              ].map((item) => (
                <Link
                  key={item.path}
                  href={`${base}/${item.path}`}
                  className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-background"
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg tone-${item.tone}`}
                  >
                    <item.icon size={17} />
                  </span>
                  <span className="text-xs font-semibold">{item.label}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <ActivityOverview
            statuses={workspace.appointments.map((a) => a.status)}
          />
          <Card className="bg-teal-soft">
            <Clock3 size={21} className="text-teal-ink" />
            <h2 className="mt-3 text-sm font-semibold text-teal-ink">
              Your business, in sync
            </h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Time zone</dt>
                <dd className="font-semibold">{business.timezone}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Currency</dt>
                <dd className="font-semibold">{business.currency}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
