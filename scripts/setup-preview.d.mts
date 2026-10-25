export function strictTLS(value: string): string;
export function previewPlan(
  envs: PreviewEnv[],
): { key: string; action: "add" | "replace" | "remove" }[];
export type PreviewEnv = {
  key: string;
  target: string[];
  gitBranch?: string;
  customEnvironmentIds?: string[];
};
export type SetupIO = {
  authenticate?: () => Promise<{
    request: (path: string, method?: string) => Promise<unknown>;
  }>;
  cli: (args: string[], input?: string, timeout?: number) => Promise<string>;
  prompt: (label: string) => Promise<string>;
  log: (message: string) => void;
  link: () => { projectId: string; orgId: string };
  source: (manifest: unknown) => { sha256: string; files: number };
  checks: (manifest: unknown) => Promise<void>;
  wait: (milliseconds: number) => Promise<void>;
  verify: (url: string, key: string) => Promise<unknown>;
  neon: (path: string, key: string, method: string) => Promise<unknown>;
};
export function runSetup(io: SetupIO): Promise<void>;
export function hiddenPrompt(label: string): Promise<string>;
export function secretFreeChecks(manifest: {
  files: { path: string; sha?: string; mode?: number }[];
}): Promise<void>;
export function verifyBuildContract(
  pkg: { scripts: Record<string, string> },
  config: {
    framework?: string;
    buildCommand?: string;
    installCommand?: string;
    outputDirectory?: string | null;
    env?: unknown;
    build?: unknown;
    builds?: unknown;
  },
): void;
