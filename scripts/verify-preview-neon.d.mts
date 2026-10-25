export const previewProject: string;
export const previewBranch: string;
export function parsePreviewDatabase(
  value: string,
): { directHost: string; database: string } | null;
export function verifyPreviewNeon(
  value: string,
  apiKey: string,
  fetcher?: (
    url: string,
    options: RequestInit,
  ) => Promise<{ ok: boolean; json: () => Promise<unknown> }>,
): Promise<{
  projectId: string;
  branchId: string;
  hostname: string;
  database: string;
}>;
export function verifyPreviewMetadata(
  value: string,
  request: (path: string) => Promise<unknown>,
): Promise<{
  projectId: string;
  branchId: string;
  hostname: string;
  database: string;
}>;
