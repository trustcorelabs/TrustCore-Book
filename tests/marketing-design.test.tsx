// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@/components/theme-select", () => ({ ThemeSelect: () => null }));
import Page from "@/app/page";
import { Feedback } from "@/components/ui/feedback";
import userEvent from "@testing-library/user-event";
it("labels the product illustration and discloses feature gates and unavailable analytics", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Manage Appointments, Clients & Your Team — All in One Place.",
  );
  for (const link of screen.getAllByRole("link", {
    name: "Create your workspace",
  })) {
    expect(link).toHaveAttribute("href", "/register");
  }
  expect(
    screen.getByRole("heading", { name: "Pricing information coming soon." }),
  ).toBeVisible();
  expect(screen.getByText(/Illustrative demo · empty workspace/)).toBeVisible();
  expect(
    screen.getByText(
      /Creating an account does not enable online booking automatically/,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /Payment-based revenue and staff utilization reporting are not currently calculated/,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "See how it works" }),
  ).toHaveAttribute("href", "#how-it-works");
});
it("announces errors and allows keyboard dismissal without resubmitting a form", async () => {
  const dismiss = vi.fn();
  render(<Feedback message="Unable to save" onDismiss={dismiss} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to save");
  const user = userEvent.setup();
  await user.tab();
  await user.keyboard("{Enter}");
  expect(dismiss).toHaveBeenCalledOnce();
  expect(
    screen.getByRole("button", { name: "Dismiss notification" }),
  ).toHaveAttribute("type", "button");
});
