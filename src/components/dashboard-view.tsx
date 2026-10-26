import Link from "next/link";
import { vocabularyFor } from "@/features/industries/presets";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Users,
  Contact,
  Sparkles,
  Check,
  Sun,
  CircleCheck,
} from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge, StatusBadge } from "./ui/badge";
import { ActivityOverview } from "./activity-overview";
import { localTime } from "@/lib/utils";
import { businessLocalDate } from "@/features/booking-engine/slots";
export type DashboardViewProps = {
  businessId: string;
  business: {
    name: string;
    timezone: string;
    currency: string;
    businessType?: string;
    terminologyMode?: string;
  };
  userName: string;
  manage: boolean;
  counts: {
    appointments: number;
    customers: number;
    services: number;
    staff: number;
  };
  appointments: {
    id: string;
    startsAt: Date;
    status: string;
    customer: { name: string };
    service: { name: string };
    staff: { name: string };
  }[];
  recentActivity?: {
    id: string;
    action: string;
    actor: string;
    createdAt: string;
  }[];
  configuredStaffCount?: number;
  now?: Date;
};
export function DashboardView({
  businessId,
  business,
  userName,
  manage,
  counts,
  appointments,
  configuredStaffCount = 0,
  now = new Date(),
  recentActivity = [],
}: DashboardViewProps) {
  const words = vocabularyFor(business);
  const base = `/app/${businessId}`;
  const upcoming = appointments
    .filter(
      (a) => a.startsAt >= now && ["PENDING", "CONFIRMED"].includes(a.status),
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 5);
  const today = businessLocalDate(now, business.timezone);
  const todayCount = appointments.filter(
    (a) =>
      businessLocalDate(a.startsAt, business.timezone) === today &&
      !["CANCELLED", "NO_SHOW"].includes(a.status),
  ).length;
  const setup = [
    {
      title: `Add your first ${words.service.toLowerCase()}`,
      note: `${words.services}, durations & prices`,
      done: counts.services > 0,
      path: "services",
      icon: Sparkles,
      tone: "purple",
    },
    {
      title: `Configure ${words.team.toLowerCase()} and working hours`,
      note: "People and working hours",
      done: configuredStaffCount > 0,
      path: "staff",
      icon: Users,
      tone: "teal",
    },
    {
      title: `Add your first ${words.customer.toLowerCase()}`,
      note: `Build your ${words.customer.toLowerCase()} directory`,
      done: counts.customers > 0,
      path: "customers",
      icon: Contact,
      tone: "sky",
    },
    {
      title: "Review appointments",
      note: "Open your appointment book · action only",
      done: false,
      path: "appointments",
      icon: CalendarDays,
      tone: "amber",
    },
  ];
  // A page visit is not persisted, so the review action is not counted as done.
  const complete = setup.slice(0, 3).filter((s) => s.done).length;
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow mb-3">Your business, at a glance</p>
          <h1 className="text-[clamp(1.8rem,3vw,2.4rem)] font-bold">
            Good to see you, {userName.split(" ")[0]}
            <span className="text-primary-ink">.</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your appointments and business records at {business.name}.
          </p>
        </div>
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-medium text-muted-foreground">
          <CalendarDays size={15} />
          <time dateTime={today}>
            {new Intl.DateTimeFormat("en", {
              timeZone: business.timezone,
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(now)}
          </time>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          {
            title: "Recorded appointments",
            count: counts.appointments,
            icon: CalendarDays,
            path: "appointments",
            note: "All appointment records",
            tone: "purple",
          },
          {
            title: words.customers,
            count: counts.customers,
            icon: Contact,
            path: "customers",
            note: `In your ${words.customer.toLowerCase()} directory`,
            tone: "teal",
          },
          {
            title: `Active ${words.services.toLowerCase()}`,
            count: counts.services,
            icon: Sparkles,
            path: "services",
            note: `In your ${words.service.toLowerCase()} menu`,
            tone: "sky",
          },
          {
            title: `Active ${words.team.toLowerCase()}`,
            count: counts.staff,
            icon: Users,
            path: "staff",
            note: "Your service professionals",
            tone: "amber",
          },
        ].map(({ title, count, icon: Icon, path, note, tone }) => (
          <Link href={`${base}/${path}`} key={path} className="min-w-0">
            <Card className="metric-card h-full p-4 sm:p-5">
              <div className="mb-5 flex items-center justify-between">
                <span
                  className={`grid size-10 place-items-center rounded-xl tone-${tone}`}
                >
                  <Icon size={19} />
                </span>
                <ArrowUpRight size={15} className="text-muted-foreground" />
              </div>
              <p className="text-[2rem] font-bold leading-none tracking-tight tabular-nums">
                {count}
              </p>
              <p className="mt-3 text-xs font-semibold sm:text-sm">{title}</p>
              <p className="mt-1 text-[10px] leading-5 text-muted-foreground sm:text-[11px]">
                {note}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="dashboard-today mb-6 flex flex-wrap items-center justify-between gap-4 py-4 sm:py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-soft text-amber-ink">
            <Sun size={21} />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {todayCount
                ? `${todayCount} appointment${todayCount === 1 ? "" : "s"} today`
                : "No appointments today"}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              Today’s non-cancelled visits in the latest 100 scheduled records ·{" "}
              {business.timezone}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`${base}/appointments`}>
            View appointments
            <ArrowRight size={14} />
          </Link>
        </Button>
      </Card>
      {manage && (
        <Card className="mb-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Badge>Get set up</Badge>
              <h2 className="mt-3 text-lg font-bold">
                Complete your workspace setup.
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {complete} of 3 setup steps complete. Review is an action.
              </p>
            </div>
            <progress
              className="h-1.5 w-24 accent-primary"
              aria-label="Business setup progress"
              value={complete}
              max={3}
            />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {setup.map(({ title, note, done, path, icon: Icon, tone }) => (
              <Link
                href={`${base}/${path}${path === "appointments" ? "" : "#add-record"}`}
                key={path}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background/60 p-4 transition-colors hover:border-primary/30"
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-lg tone-${done ? "green" : tone}`}
                >
                  {done ? <Check size={17} /> : <Icon size={17} />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{title}</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                    {note}
                  </p>
                </div>
                <ArrowUpRight
                  size={14}
                  className="ml-auto shrink-0 text-muted-foreground"
                />
              </Link>
            ))}
          </div>
        </Card>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-bold">Upcoming appointments</h2>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  Next visits in your latest 100 scheduled records
                </p>
              </div>
              <Link
                href={`${base}/appointments`}
                className="flex min-h-8 items-center gap-1 text-xs font-semibold text-primary-ink"
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
                    className="flex flex-wrap items-center gap-3 py-4"
                  >
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-primary-ink"
                      aria-hidden="true"
                    >
                      {a.customer.name.trim().slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{a.customer.name}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {a.service.name} · {a.staff.name}
                      </p>
                      <p className="mt-1 text-xs font-medium">
                        {localTime(a.startsAt, business.timezone)}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/60 p-6 text-center">
                <span className="icon-tile tone-sky mb-4">
                  <CalendarDays size={23} />
                </span>
                <h3 className="text-sm font-semibold">
                  No upcoming appointments
                </h3>
                <p className="mt-2 max-w-xs text-xs leading-6 text-muted-foreground">
                  Upcoming recorded appointments will appear here. There are
                  none in the current view.
                </p>
                <Link
                  href={`${base}/appointments`}
                  className="mt-4 text-xs font-semibold text-primary-ink"
                >
                  Open appointment book
                  <ArrowRight size={13} className="ml-1 inline" />
                </Link>
              </div>
            )}
          </Card>
          <Card>
            <h2 className="text-base font-bold">Quick actions</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              Open the tools you use most.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {setup
                .filter((step) => step.path !== "appointments")
                .map(({ path, icon: Icon, tone }) => (
                  <Link
                    key={path}
                    href={`${base}/${path}${manage ? "#add-record" : ""}`}
                    className="flex min-h-14 items-center gap-2 rounded-xl border border-border p-3 transition-colors hover:bg-background"
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-lg tone-${tone}`}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="text-xs font-medium">
                      {manage
                        ? ({
                            customers: `Add ${words.customer.toLowerCase()}`,
                            staff: `Add ${words.provider.toLowerCase()}`,
                            services: `Add ${words.service.toLowerCase()}`,
                          }[path] ?? path)
                        : ({
                            customers: `View ${words.customers.toLowerCase()}`,
                            staff: `View ${words.team.toLowerCase()}`,
                            services: `View ${words.services.toLowerCase()}`,
                          }[path] ?? path)}
                    </span>
                  </Link>
                ))}
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <ActivityOverview statuses={appointments.map((a) => a.status)} />
          {manage && (
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  Recent workspace activity
                </h2>
                <Link
                  href={`${base}/audit`}
                  className="text-xs font-semibold text-primary-ink"
                >
                  View audit log
                </Link>
              </div>
              {recentActivity.length ? (
                <ol className="mt-4 divide-y divide-border">
                  {recentActivity.map((a) => (
                    <li key={a.id} className="py-3">
                      <p className="text-xs font-medium">
                        {a.action.replaceAll(".", " ").replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {a.actor} ·{" "}
                        {localTime(new Date(a.createdAt), business.timezone)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-xs leading-6 text-muted-foreground">
                  No workspace events recorded yet.
                </p>
              )}
            </Card>
          )}
          <Card className="bg-teal-soft/60">
            <div className="flex items-center gap-2 text-teal-ink">
              <CircleCheck size={18} />
              <h2 className="text-sm font-semibold">Your workspace, in sync</h2>
            </div>
            <dl className="mt-5 space-y-3 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-muted-foreground">Time zone</dt>
                <dd className="font-medium">{business.timezone}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Currency</dt>
                <dd className="font-medium">{business.currency}</dd>
              </div>
            </dl>
            <p className="mt-5 border-t border-teal-ink/10 pt-4 text-[11px] leading-6 text-muted-foreground">
              Activity reflects recorded appointments. Revenue and staff
              utilization are not calculated here.
            </p>
          </Card>
          <div className="flex items-start gap-2 px-1 text-[11px] leading-6 text-muted-foreground">
            <Clock3 size={14} className="mt-1 shrink-0" />
            Feature availability, including online booking and membership tools,
            depends on the current deployment.
          </div>
        </div>
      </div>
    </>
  );
}
