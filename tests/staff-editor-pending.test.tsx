// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const actions = vi.hoisted(() => ({
  editCatalogRecord: vi.fn(),
  saveStaffSchedule: vi.fn(),
  addStaffTimeOff: vi.fn(),
  removeStaffTimeOff: vi.fn(),
}));
vi.mock("@/server/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
import { StaffEditor } from "@/features/staff/staff-editor";
it("prevents editing another staff operation while a save is unresolved", async () => {
  let resolve!: (value: { success: string }) => void;
  actions.editCatalogRecord.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(
    <StaffEditor
      businessId="workspace"
      timezone="Asia/Colombo"
      today="2026-10-25"
      services={[]}
      staff={[
        {
          id: "staff",
          name: "Alex",
          active: true,
          serviceIds: [],
          rules: [],
          timeOff: [],
        },
      ]}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByText("Edit profile, services & hours"));
  await user.click(screen.getByRole("button", { name: "Save details" }));
  expect(screen.getByLabelText("Name")).toBeDisabled();
  expect(screen.getByLabelText("From date")).toBeDisabled();
  resolve({ success: "Changes saved." });
  await waitFor(() => expect(screen.getByLabelText("Name")).toBeEnabled());
});
