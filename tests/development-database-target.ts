// The caller must verify Neon API metadata and schema before setting the opt-in gate.
export function approvedDevelopmentDatabase(
  url: string | undefined,
  env: Record<string, string | undefined> = process.env,
) {
  if (
    env.DEV_NEON_TARGET_VERIFIED !== "YES" ||
    env.DEV_NEON_PROJECT_ID !== "divine-dawn-11566468" ||
    env.DEV_NEON_BRANCH_ID !== "br-nameless-fog-b4cigm8d" ||
    !url
  )
    return false;
  try {
    const target = new URL(url);
    return (
      ["postgres:", "postgresql:"].includes(target.protocol) &&
      !!target.username &&
      !!target.password &&
      target.hostname === env.DEV_NEON_ENDPOINT &&
      target.hostname ===
        "ep-rapid-lake-b406ul3l.c-6.us-east-2.aws.neon.tech" &&
      /^ep-[a-z0-9-]+(?:\.[a-z0-9-]+){1,3}\.aws\.neon\.tech$/.test(
        target.hostname,
      ) &&
      !target.hostname.includes("-pooler.") &&
      target.pathname === "/neondb" &&
      (!target.port || target.port === "5432") &&
      target.searchParams.get("sslmode") === "verify-full"
    );
  } catch {
    return false;
  }
}

// Set only by test:local after checking the managed cluster's data directory and schema.
export function approvedLocalDatabase(
  url: string | undefined,
  env: Record<string, string | undefined> = process.env,
) {
  if (
    !url ||
    env.LOCAL_TEST_DATABASE_VERIFIED !== "YES" ||
    url !== env.LOCAL_TEST_DATABASE_URL
  )
    return false;
  try {
    const target = new URL(url);
    return (
      target.protocol === "postgresql:" &&
      target.hostname === "127.0.0.1" &&
      target.port === "55432" &&
      target.pathname === "/trustcore_book_local" &&
      target.username === "trustcore_local"
    );
  } catch {
    return false;
  }
}
// The checked-in GitHub Actions workflow creates this exact loopback-only service.
export function approvedCiDatabase(
  url: string | undefined,
  env: Record<string, string | undefined> = process.env,
) {
  if (
    !url ||
    env.CI !== "true" ||
    env.GITHUB_ACTIONS !== "true" ||
    url !== env.DIRECT_URL ||
    url !== env.TEST_DATABASE_URL
  )
    return false;
  try {
    const target = new URL(url);
    return (
      target.protocol === "postgresql:" &&
      target.hostname === "localhost" &&
      target.port === "5432" &&
      target.pathname === "/trustcore_ci_test" &&
      target.username === "trustcore_ci" &&
      !target.password &&
      !target.search &&
      !target.hash
    );
  } catch {
    return false;
  }
}
export function approvedTestDatabase(url: string | undefined) {
  return (
    approvedDevelopmentDatabase(url) ||
    approvedLocalDatabase(url) ||
    approvedCiDatabase(url)
  );
}
