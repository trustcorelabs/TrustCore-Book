// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mocks = vi.hoisted(() => ({ change: vi.fn(), refresh: vi.fn() }));
vi.mock("@/server/actions", () => ({ changeAppointmentStatus: mocks.change }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
import { AppointmentControls } from "@/features/appointments/appointment-controls";
it("connects pending confirmation to the tenant-scoped action and refreshes the dashboard", async () => {
  mocks.change.mockResolvedValue({ success: "Appointment updated." });
  render(
    <AppointmentControls
      businessId="business-1"
      timezone="Asia/Colombo"
      appointments={[
        {
          id: "appointment-1",
          customer: "Customer",
          startsAt: "2026-10-23T03:30:00Z",
          status: "PENDING",
        },
      ]}
    />,
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(mocks.change).toHaveBeenCalledWith(
      "business-1",
      "appointment-1",
      "CONFIRMED",
    ),
  );
  expect(screen.getByRole("status")).toHaveTextContent("Appointment updated.");
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
