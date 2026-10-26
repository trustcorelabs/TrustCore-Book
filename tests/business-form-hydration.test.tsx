// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
const actions = vi.hoisted(() => ({
  onboard: vi.fn(),
  updateBusiness: vi.fn(),
  createRecord: vi.fn(),
}));
vi.mock("@/server/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { BusinessForm } from "@/components/business-form";
import { RecordForm } from "@/components/record-form";
it("keeps server-rendered business and record forms disabled until handlers hydrate", () => {
  for (const form of [
    <BusinessForm key="business" />,
    <RecordForm
      key="record"
      businessId="preview"
      kind="staff"
      currency="LKR"
    />,
  ]) {
    const div = document.createElement("div");
    div.innerHTML = renderToString(form);
    expect(div.querySelector("fieldset")).toBeDisabled();
    expect(div.querySelector("form")).toHaveAttribute("aria-busy", "true");
  }
});
it("preserves onboarding values through review and back without saving", async () => {
  render(<BusinessForm />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Business name"), "Design Studio");
  await user.clear(screen.getByLabelText("Booking address"));
  await user.type(screen.getByLabelText("Booking address"), "design-studio");
  await user.click(screen.getByRole("button", { name: /Continue/ }));
  expect(
    await screen.findByRole("heading", { name: "Make it feel local" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Continue/ }));
  expect(
    await screen.findByRole("heading", { name: "Looking good. Ready to go?" }),
  ).toBeVisible();
  expect(screen.getByText("Design Studio")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Back/ }));
  expect(
    await screen.findByRole("heading", { name: "Make it feel local" }),
  ).toBeVisible();
  expect(actions.onboard).not.toHaveBeenCalled();
});
