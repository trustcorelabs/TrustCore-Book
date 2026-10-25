# TrustCore Book on Vercel

The intended repository is `trustcorelabs/TrustCore-Book`, branch `main`, and the
live application is `https://trustcore-book-psi.vercel.app` under the Vercel team
`trust-core-labs`. The checkout's `origin` still refers to the older GitHub account. The current
ignored `.vercel` link has been verified against the `trust-core-labs` project.
See [the Preview runbook](PREVIEW_DEPLOYMENT.md) for the verified IDs, repaired
framework settings and current runtime environment contract.

## Build settings

- Framework: Next.js
- Root directory: `.`
- Install: `pnpm install --frozen-lockfile`
- Build: `pnpm build`
- Output directory: Next.js default (`.next`)
- Node.js: the linked Vercel project currently uses 24.x, within the package's supported range.

`vercel.json` records the build/install commands. The build generates Prisma's
client but does not apply migrations. `.vercelignore` excludes local environment
files, the local PostgreSQL cluster, development secrets and generated output.

## Required server environment variables

Configure variables for each intended Vercel environment. Do not paste secrets
in chat or commit them to Git.

| Name                    | Value                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Fresh connection URL for the independently verified, separately hosted development database. The local `127.0.0.1:55432` database cannot serve Vercel. Never reuse the former production project's credentials. |
| `NEXTAUTH_URL`          | The exact HTTPS origin of the deployed application, including any custom domain.                                                                                                                                |
| `NEXTAUTH_SECRET`       | A new random secret of at least 32 characters, stored as a sensitive value.                                                                                                                                     |
| `BOOKING_MVP_ENABLED`   | `false` until that hosted target passes schema and integration gates.                                                                                                                                           |
| `A2_MEMBERSHIP_ENABLED` | `false` until that hosted target passes its membership gates.                                                                                                                                                   |

`DIRECT_URL` is for an explicitly authorized migration operation, not required
for the application's runtime. Never add a migration command to Vercel's build.
See `SEPARATE_DEV_PROJECT.md` and the read-only `pnpm dev:check` before any
migration. The current local test results do not verify a hosted Neon project.

## Deploy and verify

Once the account, target environment and hosted database are confirmed:

1. Add the required variables to the chosen Vercel environment.
2. Deploy the current source with Vercel CLI, or connect the confirmed GitHub
   repository after its intended changes have been explicitly approved for
   commit/push. CLI deployment does not require committing local changes.
3. Check the Vercel build result and HTTPS URL; ensure `NEXTAUTH_URL` matches.
4. Smoke-test login and tenant access against the verified hosted development
   database. Run booking integration/browser checks for that exact hosted target
   before enabling its booking flag.

A landing-page-only deployment can render the public homepage without a hosted
database; account and booking workflows are not functional in that mode.

## Diagnose account configuration failures

`Server environment is incomplete` means runtime validation rejected at least
one of `DATABASE_URL`, `NEXTAUTH_URL` or `NEXTAUTH_SECRET` before connecting to
the database. A successful build does not verify runtime settings. The updated
server diagnostic reports invalid variable names only, never their values.

Use `https://trustcore-book-psi.vercel.app` as `NEXTAUTH_URL` for this application's
current production domain. The installed authentication package is NextAuth v4
with a Credentials provider and JWT sessions; do not replace its configuration
with Auth.js v5 examples or add a Prisma auth adapter. Prisma stores and checks
the application's revocable sessions through the existing repositories.

Check settings on the project that actually owns this domain and the environment
of its active deployment. Changes to settings require authorization and a new
deployment before they affect existing functions. Keep both feature flags false
while the hosted schema, Neon identity and integration gates remain unverified.
Never print environment values to diagnose this issue, and do not run health
checks or submit live credentials as a substitute for verifying database identity.
