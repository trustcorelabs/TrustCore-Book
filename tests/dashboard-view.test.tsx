// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DashboardView,
  type DashboardViewProps,
} from "@/components/dashboard-view";
const props: DashboardViewProps = {
  businessId: "business-test",
  business: { name: "Test studio", timezone: "Asia/Colombo", currency: "LKR" },
  userName: "Test Owner",
  manage: true,
  counts: { appointments: 0, customers: 0, services: 0, staff: 0 },
  appointments: [],
  now: new Date("2026-10-25T00:00:00Z"),
};
describe("truthful dashboard presentation", () => {
  it("shows real counts, meaningful empty states and no invented revenue", () => {
    render(<DashboardView {...props} />);
    expect(screen.getByText("No upcoming appointments")).toBeVisible();
    expect(screen.getByText("Your activity story starts here")).toBeVisible();
    expect(
      screen.getByText("0 of 3 setup steps complete. Review is an action."),
    ).toBeVisible();
    expect(
      screen.getByText(/Revenue and staff utilization are not calculated/),
    ).toBeVisible();
    expect(
      screen.queryByText(/\$2,430|82%|Revenue overview/),
    ).not.toBeInTheDocument();
  });
  it("counts today in business time and excludes cancelled visits while keeping the scope visible", () => {
    const appointment = (id: string, startsAt: string, status: string) => ({
      id,
      startsAt: new Date(startsAt),
      status,
      customer: { name: "Fixture client" },
      service: { name: "Fixture service" },
      staff: { name: "Fixture staff" },
    });
    render(
      <DashboardView
        {...props}
        counts={{ appointments: 3, customers: 1, services: 1, staff: 1 }}
        configuredStaffCount={1}
        appointments={[
          appointment("today", "2026-10-24T20:00:00Z", "CONFIRMED"),
          appointment("cancelled", "2026-10-25T03:00:00Z", "CANCELLED"),
          appointment("tomorrow", "2026-10-25T20:00:00Z", "PENDING"),
        ]}
      />,
    );
    expect(screen.getByText("1 appointment today")).toBeVisible();
    expect(
      screen.getByText(/latest 100 scheduled records · Asia\/Colombo/),
    ).toBeVisible();
    expect(
      screen.getByText("3 of 3 setup steps complete. Review is an action."),
    ).toBeVisible();
    expect(screen.getByText("Fixture client")).toBeVisible();
  });
  it("does not count staff without saved working hours as configured", () => {
    render(
      <DashboardView
        {...props}
        counts={{ ...props.counts, services: 1, staff: 1, customers: 1 }}
        configuredStaffCount={0}
      />,
    );
    expect(
      screen.getByText("2 of 3 setup steps complete. Review is an action."),
    ).toBeVisible();
  });
  it("keeps quick actions read-oriented for non-managers and links to the current tenant", () => {
    render(<DashboardView {...props} manage={false} />);
    expect(screen.getByRole("link", { name: "View staff" })).toHaveAttribute(
      "href",
      "/app/business-test/staff",
    );
    expect(
      screen.queryByRole("link", { name: "Manage staff" }),
    ).not.toBeInTheDocument();
  });
});
