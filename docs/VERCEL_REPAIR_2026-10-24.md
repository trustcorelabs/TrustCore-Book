# Vercel configuration repair — 24 October 2026

The existing `trust-core-labs/trustcore-book` project was verified using the
logged-in `trustcorelabs-6758` account and the Vercel API. Project ID is
`prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl`; team ID is
`team_aXHNyO6VdBUxXeMU0WUJt5rd`. No project was created.

The authorized PATCH to `/v9/projects/prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl` was
successfully read back:

| Setting                       | Before             | After                                                 |
| ----------------------------- | ------------------ | ----------------------------------------------------- |
| Framework                     | `null` / Other     | `nextjs`                                              |
| Install                       | Automatic          | `pnpm install --frozen-lockfile`                      |
| Build                         | Automatic          | `pnpm build`                                          |
| Output directory              | Automatic (`null`) | Automatic (`null`), now interpreted by Next.js preset |
| Root directory                | Repository root    | Unchanged                                             |
| Node                          | `24.x`             | Unchanged                                             |
| System environment exposure   | Enabled            | Unchanged                                             |
| Project environment variables | Zero               | Zero                                                  |

Framework/build settings are project-wide and apply to future builds. This did
not deploy code, replace the running Production deployment, alter Production
secrets or add Preview variables. Current live authentication failures remain
until an authorized deployment receives valid runtime configuration. The live
validation error and zero configured project variables establish missing runtime
configuration; no database connection error or migration failure is established.

The local branch remains `main`, despite the earlier requested branch label
`dashiya/new`. Existing modified/untracked work was retained. `.env.local` and
OIDC configuration were not opened or edited. The current `.vercel/project.json`
now matches the verified project/team. The existing old-link backup was preserved
and excluded from uploads in `.vercelignore`.

Safe source changes made during preparation:

- `src/lib/env.ts`: tightly scoped Preview origin fallback using Vercel system
  metadata; require proper origin URLs; reject inherited Production origins in
  Preview; diagnostic labels contain no values.
- `src/lib/auth.ts`: contain malformed redirects and reject cross-origin and
  credential-bearing destinations.
- `src/app/api/auth/[...nextauth]/route.ts`: explicit Node runtime; preserves the
  existing local redacted 503 and rate-limit changes.
- `src/server/local-outbox-target.ts`: Vercel markers disable local outbox even
  under an incorrect development `NODE_ENV`.
- `scripts/verify-preview-neon.mjs`: hidden inputs and read-only Neon metadata
  verification against only the approved separate project/branch; no database
  access, `.env` reads, assignment or migration.
- `scripts/verify-preview-target.mjs`: fail closed on a wrong linked project/team.
- `scripts/preview-source-manifest.mjs`: Vercel dry-upload hash checks for current
  files, required auth fixes, unsafe paths and excluded local secrets. No upload
  or deployment. Companion `.d.mts` declarations keep TypeScript strict.
- Tests cover origin/redirect safety, hosted outbox denial, Neon binding, project
  identity and source manifest provenance. Prior form/design fixes were retained.

`package.json` and `pnpm-lock.yaml` agree on Next 16.4.2, NextAuth 4.24.15 and
Prisma 7.10.1. The lockfile resolves React/React DOM 19.3.1. No dependency or
lockfile change was needed. `next.config.ts` does not export a static site or
force a custom output directory. Vercel uses its normal Next.js handling.
Prisma client generation runs in postinstall and before the webpack build;
neither hook migrates, seeds or opens a database. `DIRECT_URL` remains optional
for runtime and is not supplied to Preview by the runbook.

Final checks on the current implementation:

- Unit/default suite: **251 passed, 23 skipped**, 44 passing files and 5 skipped
  files. Gated database suites were not run in this command.
- ESLint and architecture boundaries: passed.
- TypeScript and production build: passed in an isolated temporary copy with
  dummy database configuration and no local environment files.
- Local production-runtime smoke with Vercel Preview metadata: providers HTTP
  200 with correct Preview origin; anonymous session HTTP 200; onboarding HTTP
  200 carrying a Next.js streamed login redirect; hosted outbox HTTP 404 despite intentionally enabling its local
  provider settings. Dummy database was unreachable and never used by these GETs.
- Vercel dry inspection verified the current source file hashes and excluded
  environment/credential/local-database payloads. This proves preparation input,
  not deployed code: no deployment was created.
- Earlier **21 isolated DB / 8 browser** successes remain historical evidence;
  they were not repeated during this no-`.env` deployment preparation.

Remaining: run the hidden Neon metadata verifier interactively with fresh
credentials; only after it passes and Preview environment edits are authorized,
add the Preview secret values and explicit false feature flags. Hosted password
validity, schema readiness and isolated integration gates remain unverified.
Never target `quiet-mouse-55892784`. Do not enable booking/membership or apply
migrations on the basis of a successful build.

The exact environment contract and one Terminal execution checklist are in
[PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md). Its deployment and remote-variable
commands are future, approval-gated actions; none were executed by this repair.
