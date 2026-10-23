// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mocks = vi.hoisted(() => ({
  onboard: vi.fn(),
  slots: vi.fn(),
  book: vi.fn(),
}));
vi.mock("@/server/actions", () => ({
  onboard: mocks.onboard,
  updateBusiness: vi.fn(),
  loadPublicSlots: mocks.slots,
  submitPublicBooking: mocks.book,
  changeAppointmentStatus: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
import { BusinessForm } from "@/components/business-form";
import { BookingForm } from "@/features/public-booking/booking-form";
import { AppointmentList } from "@/components/appointment-list";
beforeEach(() => vi.resetAllMocks());
describe("redesigned product flows without a database", () => {
  it("validates onboarding steps and preserves details before the final submission", async () => {
    mocks.onboard.mockResolvedValue({ error: "Test server feedback" });
    render(<BusinessForm />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByLabelText("Business name")).toBeVisible();
    expect(mocks.onboard).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Business name"), "Sunday Studio");
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByLabelText("Country")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByText("Looking good. Ready to go?")).toBeVisible();
    expect(mocks.onboard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Back/ }));
    await user.selectOptions(screen.getByLabelText("Country"), "AU");
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(mocks.onboard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Create business" }));
    await waitFor(() =>
      expect(mocks.onboard).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Sunday Studio",
          slug: "sunday-studio",
          country: "AU",
          timezone: "Australia/Sydney",
        }),
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Test server feedback",
    );
  });
  it("filters actual appointments by date, customer and status", async () => {
    render(
      <AppointmentList
        businessId="b1"
        timezone="Asia/Colombo"
        appointments={[
          {
            id: "a1",
            customer: "Maya",
            service: "Consultation",
            staff: "Alex",
            startsAt: "2026-10-21T05:00:00Z",
            endsAt: "2026-10-21T05:30:00Z",
            status: "CONFIRMED",
          },
          {
            id: "a2",
            customer: "Sam",
            service: "Styling",
            staff: "Jamie",
            startsAt: "2026-10-22T05:00:00Z",
            endsAt: "2026-10-22T06:00:00Z",
            status: "CANCELLED",
          },
        ]}
      />,
    );
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Status"), "CONFIRMED");
    expect(screen.getByRole("heading", { name: "Maya" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Sam" }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Find an appointment"), "Sam");
    expect(
      screen.getByRole("heading", { name: "No appointments match" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("heading", { name: "Sam" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-10-21" },
    });
    expect(
      screen.queryByRole("heading", { name: "Sam" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maya" })).toBeVisible();
  });
  it.each([
    { error: "Booking is temporarily unavailable.", retry: true },
    {
      error: "That time is no longer available. Choose another slot.",
      retry: false,
    },
  ])("handles booking rejection: $error", async ({ error, retry }) => {
    mocks.slots.mockResolvedValue({
      slots: [
        {
          id: "signed-server-slot",
          staffName: "Alex",
          startsAt: "2026-10-21T05:00:00Z",
          endsAt: "2026-10-21T05:30:00Z",
        },
      ],
    });
    mocks.book.mockResolvedValue({
      error,
    });
    render(
      <BookingForm
        slug="studio"
        timezone="Asia/Colombo"
        currency="LKR"
        services={[
          {
            id: "service-1",
            name: "Consultation",
            durationMinutes: 30,
            price: "2500",
          },
        ]}
        minDate="2026-10-21"
        maxDate="2026-11-01"
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Find times" }));
    await user.click(await screen.findByRole("button", { name: /Alex/ }));
    await user.type(
      screen.getByLabelText("Name", { exact: true }),
      "Test Person",
    );
    await user.type(
      screen.getByLabelText("Email", { exact: true }),
      "test@example.test",
    );
    await user.click(screen.getByRole("button", { name: /Confirm booking/ }));
    await waitFor(() => expect(mocks.book).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent(error);
    if (!retry) {
      expect(
        screen.queryByRole("button", { name: /Confirm booking/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Find times" })).toBeEnabled();
      return;
    }
    await user.click(screen.getByRole("button", { name: /Confirm booking/ }));
    await waitFor(() => expect(mocks.book).toHaveBeenCalledTimes(2));
    expect(mocks.book.mock.calls[0]?.[0]).toEqual(
      mocks.book.mock.calls[1]?.[0],
    );
    expect(mocks.book.mock.calls[0]?.[0]).toMatchObject({
      slotId: "signed-server-slot",
      serviceId: "service-1",
      startsAt: "2026-10-21T05:00:00Z",
    });
  });
});
