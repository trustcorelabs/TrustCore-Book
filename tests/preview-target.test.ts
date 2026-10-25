import { expect, it } from "vitest";
import {
  assertPreviewIdentity,
  expectedPreview,
} from "../scripts/verify-preview-target.mjs";
const link = {
  projectId: expectedPreview.projectId,
  orgId: expectedPreview.orgId,
};
const project = {
  id: expectedPreview.projectId,
  accountId: expectedPreview.orgId,
  name: expectedPreview.projectName,
};
it("accepts only the independently verified team and project", () => {
  expect(() => assertPreviewIdentity(link, project)).not.toThrow();
});
it.each([
  [{ ...link, projectId: "prj_biYOfUVoy8WnMgZp6ZXmJ7JOkp7T" }, project],
  [{ ...link, orgId: "team_zzAOK82Tnt6sJegNOTvSsZtC" }, project],
  [link, { ...project, accountId: "team_other" }],
  [link, { ...project, id: "prj_other" }],
  [link, { ...project, name: "trustcore-book-s7ow" }],
])(
  "refuses stale links, another team and similarly named projects",
  (local, remote) => {
    expect(() => assertPreviewIdentity(local, remote)).toThrow(
      "project/team mismatch",
    );
  },
);
