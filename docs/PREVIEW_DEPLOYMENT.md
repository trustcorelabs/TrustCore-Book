# CLI-only Preview deployment

Prepared on 24 October 2026. This document does not authorize a deployment or
remote environment edits. Run the execution block only after explicitly approving
those Preview actions. No Production command is included.

## Recommended: one interactive Terminal command

**Verified replacement (24 October 2026):** following explicit creation approval,
created `trustcore-book-dev` (`divine-dawn-11566468`) under TrustCore Labs
(`org-broad-lab-06866989`), with independent branch `br-bold-heart-b42fnp9k`
(`main`). API GETs independently verified endpoint `ep-ancient-unit-b45mjtvt`
and database `neondb`. Preview helper guards now require this exact organization,
project, branch and endpoint. See [the metadata investigation](NEON_PREVIEW_INVESTIGATION.md).
The previous project `fragrant-hat-50630079` remains inaccessible; neither it nor
`polished-block-78280084` is selected. Creation approval does not authorize
rotation, migrations, Vercel writes or deployment; the helper's confirmations
remain mandatory. Schema readiness has not been checked and flags remain off.

```sh
node "/Users/dashinsanjana/Desktop/company website/TrustCore-Book/scripts/setup-preview.mjs"
```

This replaces the manual sequence below. It works from any directory, keeps the
current branch and dirty work, and never opens existing `.env` files. It requires
Node, npm, pnpm and the existing Vercel CLI login. The helper uses the pinned
official `neon@8.11.1` CLI from npm cache; it does not install a dependency into
this repository or read credential files itself. No private value belongs in chat
or command arguments. Existing CLI authentication is accessed only by the official
CLI. A new sign-in uses the macOS keyring, with captured authentication output.

The helper:

1. Verifies the existing Vercel project/team, framework, system variables and
   Preview record scopes. Shared Production/Preview or branch-specific records
   cause a refusal before any rotation/write. It never creates or relinks projects.
2. Authenticates first, before lengthy checks or sensitive operations. It can
   use `NEON_API_KEY` already supplied to Terminal, reuse the official CLI session,
   or offer **LOGIN** / **KEY**. LOGIN opens the official browser sign-in, not a
   Console or Dashboard setup workflow. KEY requests the complete key privately.
   Malformed/short inputs fail locally and can be retried; HTTP 401/403 identify
   authentication/permission failures without printing response bodies. No
   account, API key or session is fabricated. Metadata determines the exact
   `neondb` owner role and unique development endpoint; no URL copying is needed.
3. Checks the dry upload manifest, then runs build, TypeScript, ESLint and unit
   tests in an isolated temporary copy without local environment files. Only
   PASS/FAIL progress is shown; child output is captured, never echoed. No SQL
   connection, migration or seed is performed.
4. Requires **ROTATE DEV** before calling the development role reset endpoint.
   Rotation drops existing development connections. The helper waits for all
   returned operations to finish and fetches fresh direct connection metadata.
   New credentials remain in memory only. Alternatively, **FRESH** requests a
   hidden password that you already rotated elsewhere; it must match fresh API
   metadata. Any other input cancels without Vercel writes.
5. Uses URL parsing to set `sslmode=verify-full`, preserving other parameters,
   then independently verifies endpoint ownership again with the existing
   metadata verifier. Unexpected parameters are refused rather than silently
   removed. No database connection is used to verify ownership.
6. Shows a secret-free Preview write plan. Only **WRITE PREVIEW** permits the
   writes. The helper generates a new Preview auth secret, sets the two feature
   flags to `false`, disables email/local outbox, and removes obsolete Preview-only
   auth-origin/direct-URL overrides. All values travel to Vercel CLI via stdin,
   with `--sensitive`; no values appear in argv, history, files or progress output.
   It never calls `env update`: replacements remove only Preview scope and add a
   new Preview-only record, rechecking scope before each change. Production is
   never selected. Existing Preview sessions will be invalidated by the new secret.
7. Requires a separate **DEPLOY PREVIEW** confirmation before deployment. Return
   finishes with Preview configured and no deployment. If approved, it rechecks
   the source receipt, uploads the current working files explicitly as Preview,
   verifies deployment identity/source/readiness, then checks providers, anonymous
   session and outbox endpoints through authenticated Vercel CLI requests.
   Only PASS/FAIL and the final public Preview URL are printed, not raw responses.

All confirmation input is hidden as well. On cancellation, failure or Ctrl-C,
terminal echo is restored. Raw API responses, passwords and CLI error output are
never printed. A failed write may leave a partially completed, explicitly
confirmed plan; there is no automatic rollback or retry of rotation/deployment.
A confirmed rotation remains effective if later configuration is cancelled. If
credentials cannot be recovered, rerun and explicitly authorize a new development
rotation. The helper does not rotate Production credentials, run hosted fixtures,
verify hosted schema readiness, enable booking/membership, or deploy Production.

Neon authentication is unavoidable: without a valid existing key or CLI session,
you must approve one official browser authorization started from Terminal. If all
browser interaction is prohibited, an already-issued valid key must be provided
privately instead. Neon accounts available only through a Vercel-managed
integration may require an API key. Authentication cannot be bypassed. The
helper never runs `neon init`, `link`, `env`, `psql`, project creation or project
listing, and disables local Neon context/API-host overrides. It sends only
explicit approved development routes to the official API. The CLI login output
is captured using a Mac pseudo-terminal and `/dev/null`; no token transcript is
written. No existing credential file is opened or copied by the helper.

Safe failures include `Neon project metadata: HTTP 401`, `role metadata: HTTP 403`,
network timeout and invalid JSON, without raw server messages or input values.
The short-input check is a sanity check, not a promise that a key is valid; the
API must authenticate it. A database password is not an API key.

If initial Vercel verification fails because the CLI is logged out, run
`vercel login` interactively, then rerun the same helper. Do not pass tokens on
the command line. The Neon identity must permit metadata reads and (for ROTATE
DEV) role password reset on the verified development branch.

API references: [Neon CLI login](https://neon.com/docs/cli/login),
[Neon password rotation](https://api-docs.neon.tech/reference/resetprojectbranchrolepassword),
[Neon direct connection metadata](https://api-docs.neon.tech/reference/getconnectionuri).

## Verified identity and current blockers

Read-only Vercel CLI/API checks authenticated as `trustcorelabs-6758` and verified:

- Scope: `trust-core-labs`
- Team ID: `team_aXHNyO6VdBUxXeMU0WUJt5rd`
- Project: `trustcore-book`
- Project ID: `prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl`

The ignored local `.vercel/project.json` now matches this verified project/team.
A backup of the former link exists at `.vercel-backup-20261024-190513/` and was
preserved. Backups are excluded from uploads. The execution block verifies the
link before any environment edit; do not relink if that check already passes.

The project metadata reported no project-level environment variables. Together
with the live `Server environment is incomplete` errors, this establishes a
missing runtime configuration problem. No secret values were inspected. Shared
team inheritance and the historical deployment's exact variable values were not
inspected, so the logs cannot identify one single invalid key conclusively.

The actual local branch is `main`, not `dashiya/new`; no branch switch is made.
CLI source deployment uploads the current working files, including uncommitted
and untracked fixes accepted by `.vercelignore`. It does not redeploy a GitHub
commit. The source manifest command verifies uploaded SHA-1 entries against the
current file contents and produces a SHA-256 receipt for deployment metadata.
Do not edit source between that check and deployment. No deployed code inclusion
can be claimed until a deployment has actually occurred.

## Exact environment contract

| Name                                 | Preview requirement                                                                                                                                                                                                                                                             | Production requirement                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`                       | Required: fresh PostgreSQL URL whose endpoint has passed the metadata verifier below. Use the verified direct endpoint, `neondb`, TLS `sslmode=verify-full`. Store as Secret.                                                                                                   | Required, but outside this Preview procedure. Never use the forbidden original project. |
| `NEXTAUTH_SECRET`                    | Required: newly generated random value, at least 32 characters. Store as Secret; do not reuse another environment's secret.                                                                                                                                                     | Required, independently provisioned.                                                    |
| `NEXTAUTH_URL`                       | Leave **unset** for generated Preview URLs. Updated code uses `https://VERCEL_URL` only when `VERCEL=1` and `VERCEL_ENV=preview`. An explicitly set value must exactly match that deployment origin or configuration fails closed. Never set the Production domain for Preview. | Required HTTPS origin; current live origin is `https://trustcore-book-psi.vercel.app`.  |
| `BOOKING_MVP_ENABLED`                | Explicit `false`. Only exact `true` enables it.                                                                                                                                                                                                                                 | Keep `false` until hosted gates pass.                                                   |
| `A2_MEMBERSHIP_ENABLED`              | Explicit `false`. Only exact `true` enables it.                                                                                                                                                                                                                                 | Keep `false` until hosted gates pass.                                                   |
| `DIRECT_URL`                         | Not required. Do not add it for this procedure. Prisma generation/build do not need a working connection. It is intended for separately authorized migration tooling.                                                                                                           | Not a runtime requirement.                                                              |
| `ACCOUNT_EMAIL_PROVIDER`             | Explicit `disabled`, which the adapter treats as unconfigured. Registration/sign-in do not require email delivery; recovery/invitations will report unavailable.                                                                                                                | A separately configured real provider is required for email delivery.                   |
| `LOCAL_OUTBOX_ENABLED`               | Explicit `NO`.                                                                                                                                                                                                                                                                  | `NO` or absent.                                                                         |
| `LOCAL_OUTBOX_TARGET_APPROVED`       | Explicit `NO`.                                                                                                                                                                                                                                                                  | `NO` or absent.                                                                         |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL` | Vercel-generated system variables. Do not add user-defined copies; system-variable exposure must be enabled. The Preview origin fallback fails closed if unavailable or malformed.                                                                                              | Vercel-managed.                                                                         |

Optional real email configurations, not needed here: `ACCOUNT_EMAIL_PROVIDER=resend`
with `RESEND_API_KEY` and `ACCOUNT_EMAIL_FROM`; or `ACCOUNT_EMAIL_PROVIDER=gateway`
with `ACCOUNT_EMAIL_GATEWAY_URL` and `ACCOUNT_EMAIL_GATEWAY_TOKEN`. Never configure
`local` on Vercel or upload any `LOCAL_OUTBOX_*` secrets, seed credentials or Neon
API key. Hosted outbox access is blocked independently by `VERCEL`/`VERCEL_ENV`,
even if someone incorrectly sets `NODE_ENV=development`.

The installed authentication implementation is NextAuth **v4.24.15**, not v5.
`AUTH_URL`, `AUTH_SECRET` and `AUTH_TRUST_HOST` do not satisfy the app's required
contract. Do not set `NEXTAUTH_URL_INTERNAL` for this workflow. Do not override
Vercel's `NODE_ENV`. Auth routing explicitly uses the Node runtime, secure cookies
in production mode, JWT cookies and database-backed revocable sessions.

## Endpoint identity before assignment

`node scripts/verify-preview-neon.mjs` asks privately for the fresh URL and a Neon
metadata API key. It reads neither `.env` files nor database data. It performs
GET requests only against project `divine-dawn-11566468` and verifies branch
`br-bold-heart-b42fnp9k`, owning organization, exact endpoint ID/host, read/write
status and the `neondb` database. It rejects a branch with a parent.
A pooled hostname is mapped to its direct endpoint before comparing Neon API
metadata. Unrelated hosts, the original project, another branch and disabled
endpoints are rejected. The script never calls the original production project
`quiet-mouse-55892784`, Prisma or PostgreSQL.

This verifies endpoint ownership, not password validity, schema readiness or
hosted integration success. It intentionally does not apply migrations, create
fixtures or assign a Vercel variable. Paste exactly the same verified URL into
the following Vercel sensitive prompt. If verification fails, stop.

## Single Terminal execution checklist

The commands below match installed Vercel CLI 64.7.0. All `env add` values are
entered in interactive prompts; no credential is put in argv, shell history,
a document, an environment pull, a log or a plaintext file. `--sensitive` masks
and stores secret inputs. Do not use shell tracing (`set -x`), `--debug`,
`--value`, `env pull`, `vercel pull`, or JSON environment listings. If a key already
exists, stop and review its scope; do not add `--force` to overwrite it.

Run in an interactive macOS Terminal **after approval**:

```sh
set -e
cd '/Users/dashinsanjana/Desktop/company website/TrustCore-Book'

# No branch switch, commit or push. Confirm the existing dirty work is present.
git status --short
git branch --show-current
vercel whoami
# If authentication is unavailable, run `vercel login` yourself and retry.

# Verify the current link; preserve existing local link backups.
node scripts/verify-preview-target.mjs
# If the link fails, stop. After checking the account/project, explicitly relink:
# vercel link --project prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl --team trust-core-labs
# Then rerun the verification before continuing.

# Hidden prompts: fresh verified dev URL, then Neon metadata key. No DB connection.
node scripts/verify-preview-neon.mjs

# Paste that SAME verified URL at the masked prompt.
vercel env add DATABASE_URL --environment preview --sensitive --project prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl --scope trust-core-labs

# Generate a new secret directly into the clipboard; paste it at the next prompt.
openssl rand -base64 48 | pbcopy
vercel env add NEXTAUTH_SECRET --environment preview --sensitive --project prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl --scope trust-core-labs
pbcopy </dev/null

# Enter false, false, disabled, NO, NO respectively at the prompts.
vercel env add BOOKING_MVP_ENABLED --environment preview --no-sensitive --project prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl --scope trust-core-labs
vercel env add A2_MEMBERSHIP_ENABLED --environment preview --no-sensitive --project prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl --scope trust-core-labs
vercel env add ACCOUNT_EMAIL_PROVIDER --environment preview --no-sensitive --project prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl --scope trust-core-labs
vercel env add LOCAL_OUTBOX_ENABLED --environment preview --no-sensitive --project prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl --scope trust-core-labs
vercel env add LOCAL_OUTBOX_TARGET_APPROVED --environment preview --no-sensitive --project prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl --scope trust-core-labs

# NEXTAUTH_URL is intentionally NOT set in Preview. Do not inherit a production URL.
# No DIRECT_URL, local outbox credentials or Neon metadata API key is uploaded.
node scripts/verify-preview-target.mjs
TRUSTCORE_SOURCE_RECEIPT="$(node scripts/preview-source-manifest.mjs)"
TRUSTCORE_SOURCE_SHA="$(node -e 'console.log(JSON.parse(process.argv[1]).sha256)' "$TRUSTCORE_SOURCE_RECEIPT")"

# Upload this working directory, including local fixes. Explicitly Preview, never --prod.
# Do not use redeploy/prebuilt: those may reuse old source or local environment artifacts.
TRUSTCORE_PREVIEW_URL="$(vercel deploy . --environment preview --force --project prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl --scope trust-core-labs --meta localSourceSha256="$TRUSTCORE_SOURCE_SHA")"
vercel inspect "$TRUSTCORE_PREVIEW_URL" --scope trust-core-labs

# Read-only auth smoke checks: no credentials, fixtures, health probes or DB writes.
# Vercel curl authenticates to protected Preview without disabling its protection.
vercel curl /api/auth/providers --deployment "$TRUSTCORE_PREVIEW_URL" --scope trust-core-labs
vercel curl /api/auth/session --deployment "$TRUSTCORE_PREVIEW_URL" --scope trust-core-labs
vercel curl /api/dev/outbox --deployment "$TRUSTCORE_PREVIEW_URL" --scope trust-core-labs
vercel logs --deployment "$TRUSTCORE_PREVIEW_URL" --environment preview --project prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl --scope trust-core-labs --since 10m
```

Verify the inspection identifies Preview in the expected team/project. Auth
providers should return HTTP 200 with the Credentials provider and Preview-origin
URLs; session should return HTTP 200 with an empty anonymous session. Outbox must
return 404. Configuration failures return redacted 503 with `Cache-Control:
no-store`; server diagnostics report invalid variable names only. A 401 from
Preview protection is not an app failure: use the authenticated `vercel curl`
command, not a public bypass token or disabled protection.

Compare deployment metadata `localSourceSha256` with `TRUSTCORE_SOURCE_SHA` using
read-only `vercel inspect`/deployment API inspection. This is a source upload
receipt, not a substitute for runtime tests. Capture private screenshots/logs
without posting tokens or credentials. Do not submit real credentials or bookings
until independent Neon identity and schema verification are complete and isolated
hosted fixtures are explicitly authorized.

## Build and release boundaries

`vercel.json` fixes framework/install/build settings in source. The existing
remote project has now been repaired through the supported project PATCH API:
`framework=nextjs`, `installCommand=pnpm install --frozen-lockfile`,
`buildCommand=pnpm build`, `outputDirectory=null`. Node remains 24.x, root remains
repository root and automatic system-variable exposure remains enabled. These
project-wide build settings affect future builds; the running Production
deployment and all environment variables were left unchanged. Install is
`pnpm install --frozen-lockfile`; both postinstall and build generate Prisma's
client. Build is `prisma generate && next build --webpack`. No migration or seed
command is invoked. `.vercelignore` excludes environment files, local database,
credentials, generated client and build/test artifacts; the client is regenerated
on Vercel. Do not add database mutations to the install/build chain.

The original Production deployment is unchanged by this preparation. No
deployment, environment-variable change, hosted schema check or hosted integration
verification was performed. Only the explicitly authorized project build settings
were updated and read back successfully. Both hosted feature flags must remain
false until the required schema and isolated integration gates pass.

References: [Vercel CLI deployment](https://vercel.com/docs/cli/deploy),
[environment scopes](https://vercel.com/docs/environment-variables/manage-across-environments).
Installed CLI help was checked for the exact commands above.
