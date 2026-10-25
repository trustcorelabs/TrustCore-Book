export const expectedPreview: {
  projectId: string;
  orgId: string;
  projectName: string;
  scope: string;
};
export function assertPreviewIdentity(
  link: { projectId: string; orgId: string },
  project: { id: string; accountId: string; name: string },
): void;
