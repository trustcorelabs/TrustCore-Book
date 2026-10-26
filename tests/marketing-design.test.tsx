// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@/components/theme-select", () => ({ ThemeSelect: () => null }));
import Page from "@/app/page";
import { Feedback } from "@/components/ui/feedback";
import userEvent from "@testing-library/user-event";
it("labels the product illustration and discloses feature gates and unavailable analytics", () => {
  render(<Page />);
  expect(
    screen.getByText(/Workspace preview · illustrative empty state/),
  ).toBeVisible();
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
    screen.getByRole("link", { name: "Explore features" }),
  ).toHaveAttribute("href", "#features");
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
