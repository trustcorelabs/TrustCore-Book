import "server-only";
import { verifyLocalOutboxDatabase } from "@/server/repositories/local-outbox";

export type LocalOutboxTarget = {
  origin: string;
  host: string;
  database: string;
  projectId: string;
  branchId: string;
  branchName: string;
  apiKey: string;
  accessToken: string;
};

function directDatabase(urlString: string, host: string, database: string) {
  try {
    const url = new URL(urlString);
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname === host &&
      decodeURIComponent(url.pathname.slice(1)) === database &&
      !!url.username &&
      !!url.password &&
      (!url.port || url.port === "5432") &&
      !url.hash &&
      url.searchParams.get("sslmode") === "verify-full" &&
      [...url.searchParams.keys()].every((key) =>
        ["sslmode", "channel_binding"].includes(key),
      )
    );
  } catch {
    return false;
  }
}

export function localOutboxTarget(
  env: Record<string, string | undefined>,
): LocalOutboxTarget | null {
  if (
    !!env.VERCEL ||
    !!env.VERCEL_ENV ||
    env.NODE_ENV !== "development" ||
    env.ACCOUNT_EMAIL_PROVIDER !== "local" ||
    env.LOCAL_OUTBOX_ENABLED !== "YES" ||
    env.LOCAL_OUTBOX_TARGET_APPROVED !== "YES"
  )
    return null;
  const host = env.LOCAL_OUTBOX_EXPECTED_ENDPOINT;
  const database = env.LOCAL_OUTBOX_EXPECTED_DATABASE;
  const projectId = env.LOCAL_OUTBOX_NEON_PROJECT_ID;
  const branchId = env.LOCAL_OUTBOX_NEON_BRANCH_ID;
  const branchName = env.LOCAL_OUTBOX_NEON_BRANCH_NAME;
  const apiKey = env.LOCAL_OUTBOX_NEON_API_KEY;
  const accessToken = env.LOCAL_OUTBOX_ACCESS_TOKEN;
  const dedicatedDevProject =
    projectId === "fragrant-hat-50630079" &&
    branchId === "br-dark-brook-b4vdolwu" &&
    branchName === "production" &&
    database === "neondb";
  if (
    !host ||
    !database ||
    !projectId ||
    !branchId ||
    !branchName ||
    !apiKey ||
    !accessToken ||
    !/^[A-Za-z0-9_-]{43}$/.test(accessToken) ||
    !/^ep-[a-z0-9-]+(?:\.[a-z0-9-]+){1,3}\.aws\.neon\.tech$/.test(host) ||
    host.includes("-pooler.") ||
    (!dedicatedDevProject &&
      (!/^[a-z0-9_]+_(dev|test)$/.test(database) ||
        /(prod|production|shared|neondb)/.test(database))) ||
    !/^br-[a-z0-9-]+$/.test(branchId) ||
    !/^[a-z0-9-]+$/.test(projectId) ||
    (!dedicatedDevProject &&
      (!/(dev|test)/i.test(branchName) ||
        /^(main|master|production|prod)$/i.test(branchName))) ||
    !env.DATABASE_URL ||
    !directDatabase(env.DATABASE_URL, host, database) ||
    (env.DIRECT_URL && !directDatabase(env.DIRECT_URL, host, database))
  )
    return null;
  try {
    const app = new URL(env.NEXTAUTH_URL ?? "");
    if (
      !["http:", "https:"].includes(app.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(app.hostname) ||
      app.pathname !== "/" ||
      app.search ||
      app.hash ||
      app.username ||
      app.password
    )
      return null;
    return {
      origin: app.origin,
      host,
      database,
      projectId,
      branchId,
      branchName,
      apiKey,
      accessToken,
    };
  } catch {
    return null;
  }
}

export function assertLocalNeonMetadata(
  target: LocalOutboxTarget,
  branch: Record<string, unknown>,
  endpoints: Record<string, unknown>[],
  now = Date.now(),
) {
  const dedicatedDevProject =
    target.projectId === "fragrant-hat-50630079" &&
    target.branchId === "br-dark-brook-b4vdolwu" &&
    target.branchName === "production" &&
    target.database === "neondb";
  if (
    branch.id !== target.branchId ||
    branch.name !== target.branchName ||
    (!dedicatedDevProject &&
      (typeof branch.parent_id !== "string" || !branch.parent_id)) ||
    (!dedicatedDevProject && branch.protected === true) ||
    (!dedicatedDevProject &&
      (branch.default === true || branch.is_default === true)) ||
    (branch.expires_at != null &&
      (typeof branch.expires_at !== "string" ||
        !Number.isFinite(Date.parse(branch.expires_at)) ||
        Date.parse(branch.expires_at) <= now)) ||
    !endpoints.some(
      (endpoint) =>
        endpoint.host === target.host &&
        endpoint.branch_id === target.branchId &&
        endpoint.project_id === target.projectId &&
        endpoint.type === "read_write" &&
        endpoint.disabled !== true,
    )
  )
    throw new Error("Local outbox target unavailable");
}

export async function verifyLocalOutboxTarget(target: LocalOutboxTarget) {
  const base = `https://console.neon.tech/api/v2/projects/${target.projectId}`;
  const headers = { Authorization: `Bearer ${target.apiKey}` };
  const [branchResponse, endpointsResponse] = await Promise.all([
    fetch(`${base}/branches/${target.branchId}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`${base}/endpoints`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
  ]);
  if (!branchResponse.ok || !endpointsResponse.ok)
    throw new Error("Local outbox target unavailable");
  const branchBody = await branchResponse.json();
  const endpointsBody = await endpointsResponse.json();
  if (!branchBody?.branch || !Array.isArray(endpointsBody?.endpoints))
    throw new Error("Local outbox target unavailable");
  assertLocalNeonMetadata(target, branchBody.branch, endpointsBody.endpoints);

  await verifyLocalOutboxDatabase(target.database);
}
