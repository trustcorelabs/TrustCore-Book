import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const expectedPreview = {
  projectId: "prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl",
  orgId: "team_aXHNyO6VdBUxXeMU0WUJt5rd",
  projectName: "trustcore-book",
  scope: "trust-core-labs",
};
export function assertPreviewIdentity(link, project) {
  if (
    link.projectId !== expectedPreview.projectId ||
    link.orgId !== expectedPreview.orgId ||
    project.id !== expectedPreview.projectId ||
    project.accountId !== expectedPreview.orgId ||
    project.name !== expectedPreview.projectName
  ) {
    throw new Error(
      "Vercel project/team mismatch. Stop; do not deploy or edit remote environments.",
    );
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const link = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
    // Refuse stale links before invoking any remote tool.
    assertPreviewIdentity(link, {
      id: expectedPreview.projectId,
      accountId: expectedPreview.orgId,
      name: expectedPreview.projectName,
    });
    const response = spawnSync(
      "vercel",
      [
        "api",
        "/v9/projects/trustcore-book",
        "--scope",
        expectedPreview.scope,
        "--non-interactive",
      ],
      { encoding: "utf8", timeout: 15000 },
    );
    if (response.status !== 0)
      throw new Error(
        "Unable to verify the Vercel account/project. Log in interactively and retry.",
      );
    assertPreviewIdentity(link, JSON.parse(response.stdout));
    console.log(
      "Verified Vercel project/team: trust-core-labs/trustcore-book. No settings changed.",
    );
  } catch (error) {
    console.error(
      error instanceof Error &&
        /^(Vercel project|Unable to verify)/.test(error.message)
        ? error.message
        : "Preview target verification failed. No settings changed.",
    );
    process.exitCode = 1;
  }
}
