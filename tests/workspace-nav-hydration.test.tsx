// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/preview",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/theme-select", () => ({ ThemeSelect: () => null }));
import { WorkspaceNav } from "@/components/workspace-nav";
const props = {
  businessId: "preview",
  name: "A studio",
  slug: "a-studio",
  canManageMembers: false,
  businesses: [{ id: "preview", name: "A studio" }],
};
it("does not advertise server-rendered navigation controls as interactive before hydration", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<WorkspaceNav {...props} />);
  expect(
    container.querySelector('button[aria-label="Open navigation"]'),
  ).toBeDisabled();
  expect(
    container.querySelector('select[aria-label="Business workspace"]'),
  ).toBeDisabled();
});
it("enables navigation after hydration and retains current tenant and page semantics", () => {
  render(<WorkspaceNav {...props} />);
  expect(screen.getByRole("button", { name: "Open navigation" })).toBeEnabled();
  expect(screen.getAllByRole("link", { name: "Dashboard" })[0]).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(
    screen.getAllByRole("combobox", { name: "Business workspace" })[0],
  ).toBeEnabled();
});
