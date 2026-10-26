export type ModuleDefinition = {
  id: string;
  title: string;
  priority: "MVP" | "Later";
  status: "available" | "partial" | "gated" | "planned";
  route: string;
  summary: string;
  dependencies: string;
  acceptance: string;
  flag?: "booking" | "membership" | "email";
  managerOnly?: boolean;
};
export const modules = [
  {
    id: "authentication",
    title: "Authentication",
    priority: "MVP",
    status: "available",
    route: "/login",
    summary:
      "Registration, sign-in and sign-out with server-validated sessions.",
    dependencies: "users-sessions,security",
    acceptance:
      "Authenticated access or generic rejection without credential disclosure.",
  },
  {
    id: "users-sessions",
    title: "Account and sessions",
    priority: "MVP",
    status: "available",
    route: "/account",
    summary:
      "Update your profile or password, view sessions and sign out individual or all sessions.",
    dependencies: "authentication",
    acceptance: "Account-owner controls with server-side session revocation.",
  },
  {
    id: "business-onboarding",
    title: "Business onboarding",
    priority: "MVP",
    status: "available",
    route: "/onboarding",
    summary:
      "Create a workspace with a booking address, region and industry presets. Suggestions never insert business records.",
    dependencies: "authentication,permissions",
    acceptance: "Business, owner membership and audit event commit together.",
  },
  {
    id: "businesses",
    title: "Business management",
    priority: "MVP",
    status: "available",
    route: "settings",
    summary:
      "Switch between your workspaces and manage the current business profile.",
    dependencies: "authentication,permissions",
    acceptance: "Access is checked against current business membership.",
  },
  {
    id: "permissions",
    title: "Team invitations and membership",
    priority: "MVP",
    status: "gated",
    flag: "membership",
    managerOnly: true,
    route: "members",
    summary:
      "Invitations, roles and ownership transfer are implemented behind the membership flag. Workspace RBAC is always enforced.",
    dependencies: "authentication",
    acceptance:
      "Last-owner protection, invitation expiry and cross-tenant denial.",
  },
  {
    id: "services",
    title: "Services",
    priority: "MVP",
    status: "available",
    route: "services",
    summary:
      "Manage services, categories, optional add-ons, packages, prices, durations and buffers.",
    dependencies: "businesses,permissions",
    acceptance: "Server-owned prices and tenant-scoped service updates.",
  },
  {
    id: "staff",
    title: "Staff management",
    priority: "MVP",
    status: "available",
    route: "staff",
    summary:
      "Manage staff profiles, service assignments, recurring working hours and time off.",
    dependencies: "businesses,services",
    acceptance:
      "Assignments, schedules and exceptions remain in the current tenant.",
  },
  {
    id: "availability",
    title: "Working hours and availability",
    priority: "MVP",
    status: "available",
    route: "staff",
    summary:
      "Configure weekly working periods and time off. Public slot discovery remains feature-gated.",
    dependencies: "staff,localization",
    acceptance:
      "Working periods and time-off intervals validate in the business timezone.",
  },
  {
    id: "customers",
    title: "Customer directory and history",
    priority: "MVP",
    status: "partial",
    route: "customers",
    summary:
      "Create and search customers, review recorded visits and appointment-email consent. Owners and admins can add private service notes after the new migration.",
    dependencies: "businesses,permissions",
    acceptance:
      "Customer profiles and nested visits are scoped to the business.",
  },
  {
    id: "appointments",
    title: "Appointment management",
    priority: "MVP",
    status: "available",
    route: "appointments",
    summary:
      "Review recorded appointments and manage confirmation, cancellation, completion and no-show status.",
    dependencies: "customers,staff,services",
    acceptance:
      "Status changes check current manager membership and audit atomically.",
  },
  {
    id: "calendar",
    title: "Day, week and month calendar",
    priority: "MVP",
    status: "available",
    route: "calendar",
    summary:
      "Browse appointments, filter staff/status, inspect details and see working-hours/time-off context. Mobile uses an accessible agenda.",
    dependencies: "appointments,availability",
    acceptance:
      "Business timezone boundaries, bounded queries and no unsupported drag-to-reschedule.",
  },
  {
    id: "booking-engine",
    title: "Booking availability engine",
    priority: "MVP",
    status: "gated",
    flag: "booking",
    route: "calendar",
    summary:
      "Slot discovery and idempotent transactional booking are implemented and gated. Signed customer lookup/cancellation and manager rescheduling are implemented. Customer rescheduling uses a 15-minute authorization, original-start checks and a durable operation ledger. Configurable buffers and policies are implemented.",
    dependencies: "availability,staff,services",
    acceptance:
      "Overlapping appointments and duplicate submissions are blocked.",
  },
  {
    id: "public-booking",
    title: "Public booking portal",
    priority: "MVP",
    status: "partial",
    route: "public-booking",
    summary:
      "Public service menus are available. Slot selection and confirmation require the booking flag; no payment gateway is advertised.",
    dependencies: "booking-engine",
    acceptance: "Only explicit public business/service fields are exposed.",
  },
  {
    id: "notifications",
    title: "Emails and reminders",
    priority: "MVP",
    status: "partial",
    flag: "email",
    route: "notifications",
    summary:
      "Account email adapters exist, but require a verified provider. Appointment notification jobs and automatic reminder delivery are not active.",
    dependencies: "appointments",
    acceptance:
      "No hosted local outbox, simulated delivery or unverified provider success.",
  },
  {
    id: "dashboard",
    title: "Business dashboard",
    priority: "MVP",
    status: "available",
    route: "",
    summary:
      "Actual workspace counts, upcoming appointments, activity breakdowns and a setup checklist.",
    dependencies: "appointments,customers,staff,services",
    acceptance: "No fabricated appointments, revenue, utilization or growth.",
  },
  {
    id: "analytics",
    title: "Appointment reports",
    priority: "MVP",
    status: "available",
    route: "reports",
    summary:
      "Date-filtered daily appointment totals, cancellation/no-show rates, service popularity and completed service time. Manager-only CSV export.",
    dependencies: "appointments",
    acceptance:
      "Business-local date boundaries, partial-data warnings and no price-as-revenue estimates.",
  },
  {
    id: "billing",
    title: "Subscription billing",
    priority: "Later",
    status: "planned",
    route: "billing",
    summary:
      "Paid plans, trials and subscription entitlements are not active. Merchant and provider verification is required.",
    dependencies: "payments",
    acceptance: "No paid entitlement is granted from browser assertions.",
  },
  {
    id: "payments",
    title: "Payments and deposits",
    priority: "Later",
    status: "planned",
    route: "payments",
    summary:
      "Payment collection, deposits and refunds are not available. Regional merchant onboarding and verified test-mode integration are required.",
    dependencies: "security",
    acceptance: "No card data storage or simulated live payment success.",
  },
  {
    id: "platform-admin",
    title: "Platform overview",
    priority: "MVP",
    status: "partial",
    route: "/admin",
    summary:
      "Platform administrators can view the business overview. Broader administration tools are not implemented.",
    dependencies: "permissions",
    acceptance:
      "Platform permission does not bypass tenant-write authorization.",
  },
  {
    id: "business-settings",
    title: "Business settings",
    priority: "MVP",
    status: "available",
    route: "settings",
    summary: "Update the business name, public booking address and timezone.",
    dependencies: "businesses,permissions",
    acceptance: "Current manager membership and validated regional settings.",
  },
  {
    id: "localization",
    title: "Timezone and currency",
    priority: "MVP",
    status: "partial",
    route: "settings",
    summary:
      "Business-local dates and supported regional currencies are available. Additional interface languages are not implemented.",
    dependencies: "businesses",
    acceptance: "UTC storage is distinct from business-local presentation.",
  },
  {
    id: "audit",
    title: "Audit log",
    priority: "MVP",
    status: "available",
    managerOnly: true,
    route: "audit",
    summary:
      "Owners and admins can search the latest 100 workspace audit events.",
    dependencies: "permissions",
    acceptance: "No cross-tenant event reads or credentials in event payloads.",
  },
  {
    id: "security",
    title: "Account security",
    priority: "MVP",
    status: "partial",
    route: "/account",
    summary:
      "Password changes, session controls, permission checks and abuse limits are implemented. A service-monitoring console is not.",
    dependencies: "authentication,permissions",
    acceptance: "Private credentials remain server-only.",
  },
] as const satisfies readonly ModuleDefinition[];
export function moduleHref(
  module: ModuleDefinition,
  businessId: string,
  businessSlug?: string,
) {
  if (module.id === "public-booking" && businessSlug)
    return `/book/${businessSlug}`;
  return module.route.startsWith("/")
    ? module.route
    : `/app/${businessId}${module.route ? `/${module.route}` : ""}`;
}
export function moduleLabel(
  module: ModuleDefinition,
  flags: { booking: boolean; membership: boolean; email: boolean },
) {
  if (module.flag && !flags[module.flag]) return "Disabled / not configured";
  return {
    available: "Available",
    partial: "Partially available",
    gated: "Enabled",
    planned: "Not implemented",
  }[module.status];
}
