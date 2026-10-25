export const requiredPreviewFiles: string[];
export function verifySourceManifest(
  manifest: { files: { path: string; sha?: string; mode?: number }[] },
  read?: (path: string) => Buffer,
): { files: number; sha256: string };
