export const approvedNeonProject: string;
export const approvedNeonBranch: string;
export const approvedNeonOrganization: string;
export const approvedNeonEndpoint: string;
export const approvedNeonHostname: string;
export const neonCliVersion: string;
export class NeonSetupError extends Error {
  status?: number;
}
export function validateNeonApiKey(value: string | undefined): string;
export function neonStage(path: string): string;
export function assertNeonRequest(path: string, method: string): void;
export function apiFailure(
  path: string,
  status?: number,
  detail?: string,
): NeonSetupError;
export type NeonFetch = (
  url: string,
  options: RequestInit,
) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;
export function requestNeon(
  key: string,
  path: string,
  method?: string,
  fetcher?: NeonFetch,
): Promise<unknown>;
export type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};
export function parseCliResponse(path: string, result: CliResult): unknown;
export type NeonAuthentication = {
  request: (path: string, method?: string) => Promise<unknown>;
};
export function authenticateNeon(options: {
  prompt: (message: string) => Promise<string>;
  log: (message: string) => void;
  run?: (args: string[], login?: boolean) => CliResult | Promise<CliResult>;
  environmentKey?: string;
  fetcher?: NeonFetch;
}): Promise<NeonAuthentication>;
