"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import {
  CalendarDays,
  CalendarRange,
  FileChartColumn,
  ScrollText,
  LayoutDashboard,
  Sparkles,
  Users,
  Contact,
  Settings,
  ArrowUpRight,
  Plus,
  Grid2X2,
  UsersRound,
  Menu,
  X,
  PanelLeftClose,
} from "lucide-react";
import { ThemeSelect } from "./theme-select";
import { Brand } from "./brand";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";
const items = [
  { path: "", label: "Dashboard", icon: LayoutDashboard, tone: "purple" },
  { path: "calendar", label: "Calendar", icon: CalendarRange, tone: "sky" },
  { path: "reports", label: "Reports", icon: FileChartColumn, tone: "purple" },
  {
    path: "appointments",
    label: "Appointments",
    icon: CalendarDays,
    tone: "sky",
  },
  { path: "services", label: "Services", icon: Sparkles, tone: "pink" },
  { path: "staff", label: "Staff", icon: Users, tone: "teal" },
  { path: "customers", label: "Customers", icon: Contact, tone: "amber" },
];
export function WorkspaceNav({
  businessId,
  name,
  slug,
  canManageMembers,
  businesses,
}: {
  businessId: string;
  name: string;
  slug: string;
  canManageMembers: boolean;
  businesses: { id: string; name: string }[];
}) {
  const hydrated = useHydrated();
  const path = usePathname();
  const router = useRouter();
  const drawer = useRef<HTMLDialogElement>(null);
  const base = `/app/${businessId}`;
  const close = () => drawer.current?.close();
  const content = (
    <>
      <div className="mb-8 px-2">
        <Brand />
      </div>
      <div className="mb-7 rounded-xl border border-border bg-background p-3">
        <p className="eyebrow mb-2">Business workspace</p>
        <select
          aria-label="Business workspace"
          title={name}
          disabled={!hydrated}
          className="input h-10 font-semibold"
          value={businessId}
          onChange={(e) => {
            router.push(`/app/${e.target.value}`);
            close();
          }}
        >
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <Link
          onClick={close}
          href="/onboarding"
          className="mt-3 flex items-center gap-2 px-1 text-xs font-semibold text-primary-ink"
        >
          <Plus size={14} />
          Add a business
        </Link>
      </div>
      <p className="eyebrow mb-3 px-3 text-muted-foreground">Workspace</p>
      <nav aria-label="Business navigation" className="space-y-1.5">
        {items.map((item) => {
          const href = item.path ? `${base}/${item.path}` : base;
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={close}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl p-2.5 text-[13px] font-semibold transition-colors",
                active
                  ? "bg-accent text-primary-ink"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg",
                  active
                    ? "bg-primary/10 text-primary-ink"
                    : "text-muted-foreground",
                )}
              >
                <item.icon size={17} aria-hidden="true" />
              </span>
              {item.label}
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
        {canManageMembers && (
          <Link
            onClick={close}
            href={`${base}/members`}
            aria-current={path === `${base}/members` ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl p-2.5 text-[13px] font-semibold",
              path === `${base}/members`
                ? "bg-accent text-primary-ink"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <span className="grid size-8 place-items-center rounded-lg tone-teal">
              <UsersRound size={17} />
            </span>
            Membership
          </Link>
        )}
      </nav>
      {canManageMembers && (
        <Link
          href={`${base}/audit`}
          onClick={close}
          className="mt-2 flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium text-muted-foreground hover:bg-muted"
        >
          <ScrollText size={17} />
          Audit log
        </Link>
      )}
      <div className="mt-7 border-t border-border pt-5">
        <p className="eyebrow mb-3 px-3 text-muted-foreground">Manage</p>
        {[
          { path: "modules", label: "All modules", icon: Grid2X2 },
          { path: "settings", label: "Business settings", icon: Settings },
        ].map((item) => (
          <Link
            key={item.path}
            onClick={close}
            href={`${base}/${item.path}`}
            aria-current={path === `${base}/${item.path}` ? "page" : undefined}
            className={cn(
              "mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium",
              path === `${base}/${item.path}`
                ? "bg-accent text-primary-ink"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <item.icon size={17} />
            {item.label}
          </Link>
        ))}
      </div>
      <div className="mt-auto pt-8">
        <div className="mb-5 lg:hidden">
          <ThemeSelect />
        </div>
        <div className="rounded-2xl bg-teal-soft p-4">
          <p className="text-sm font-semibold text-teal-ink">
            A little more room for your craft.
          </p>
          <Link
            onClick={close}
            href={`/book/${slug}`}
            className="mt-3 flex items-center gap-2 text-xs font-semibold text-teal-ink"
          >
            View public page
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <p className="mt-5 px-2 text-[11px] text-muted-foreground">
          TrustCore Book · By TrustCore Labs
        </p>
      </div>
    </>
  );
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col overflow-y-auto border-r border-border workspace-sidebar bg-card px-4 py-6 lg:flex">
        {content}
      </aside>
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-4 lg:hidden">
        <Brand />
        <button
          type="button"
          aria-label="Open navigation"
          aria-haspopup="dialog"
          disabled={!hydrated}
          aria-busy={!hydrated}
          onClick={() => drawer.current?.showModal()}
          className="grid size-11 place-items-center rounded-xl border border-border"
        >
          <Menu size={21} />
        </button>
      </div>
      <dialog
        ref={drawer}
        aria-label="Workspace navigation"
        className="workspace-sidebar fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-[min(320px,90vw)] border-0 bg-card p-5 text-foreground shadow-float backdrop:bg-foreground/35"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientX > rect.right) close();
          }
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <span className="eyebrow flex items-center gap-2">
            <PanelLeftClose size={15} />
            Navigation
          </span>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={close}
            className="grid size-11 place-items-center rounded-xl hover:bg-muted"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex min-h-[calc(100%-4rem)] flex-col">{content}</div>
      </dialog>
    </>
  );
}
