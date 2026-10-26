// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/actions", () => ({ changeAppointmentStatus: vi.fn() }));
import { CalendarView } from "@/features/calendar/calendar-view";
const appointments = [
  {
    id: "appointment-a",
    staffId: "staff-a",
    customer: "Fixture client",
    service: "Consultation",
    staff: "Alex",
    startsAt: "2026-10-25T10:00:00Z",
    endsAt: "2026-10-25T11:00:00Z",
    status: "CONFIRMED",
  },
  {
    id: "appointment-b",
    staffId: "staff-b",
    customer: "Other client",
    service: "Care",
    staff: "Sam",
    startsAt: "2026-10-25T12:00:00Z",
    endsAt: "2026-10-25T13:00:00Z",
    status: "CANCELLED",
  },
];
const staff = [
  {
    id: "staff-a",
    name: "Alex",
    active: true,
    rules: [{ weekday: 0, startMinute: 540, endMinute: 1020 }],
    timeOff: [],
  },
  { id: "staff-b", name: "Sam", active: true, rules: [], timeOff: [] },
];
it("filters resources and status without creating or moving reservations", async () => {
  render(
    <CalendarView
      businessId="business"
      timezone="UTC"
      day="2026-10-25"
      mode="day"
      appointments={appointments}
      staff={staff}
    />,
  );
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Staff"), "staff-a");
  expect(screen.queryByText("Other client")).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Status"), "CANCELLED");
  expect(screen.queryByText("Fixture client")).not.toBeInTheDocument();
  expect(
    screen.getByText(/Schedule changes are not performed by dragging/),
  ).toBeVisible();
});
it("opens a keyboard-accessible detail dialog and exposes status mutation only to managers", async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  render(
    <CalendarView
      businessId="business"
      timezone="UTC"
      day="2026-10-25"
      mode="day"
      appointments={appointments.slice(0, 1)}
      staff={staff}
      manage={false}
    />,
  );
  const user = userEvent.setup();
  await user.click(
    screen.getAllByRole("button", { name: /Fixture client/ })[0]!,
  );
  const dialog = screen.getByRole("dialog", { name: "Appointment details" });
  expect(within(dialog).getByText("Consultation · Alex")).toBeVisible();
  expect(
    within(dialog).queryByRole("button", { name: /^Cancel$/ }),
  ).not.toBeInTheDocument();
  await user.click(
    within(dialog).getByRole("button", { name: "Close appointment details" }),
  );
  expect(dialog).not.toHaveAttribute("open");
});
