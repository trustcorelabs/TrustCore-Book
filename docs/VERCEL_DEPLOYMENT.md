# TrustCore Book on Vercel

The local checkout is linked to the Vercel project `trustcore-book` under
`dashinsanjana-1730s-projects`. The screenshot repository is
`trustcorelabs/TrustCore-Book`, while this checkout's Git remote currently points
to `Dashin-sanjana/TrustCore-Book` on branch `dashiya/new`. Confirm the intended
Git repository before connecting automatic deployments. Local changes have not
been committed or pushed by this setup.

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

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Fresh connection URL for the independently verified, separately hosted development database. The local `127.0.0.1:55432` database cannot serve Vercel. Never reuse the former production project's credentials. |
| `NEXTAUTH_URL` | The exact HTTPS origin of the deployed application, including any custom domain. |
| `NEXTAUTH_SECRET` | A new random secret of at least 32 characters, stored as a sensitive value. |
| `BOOKING_MVP_ENABLED` | `false` until that hosted target passes schema and integration gates. |
| `A2_MEMBERSHIP_ENABLED` | `false` until that hosted target passes its membership gates. |

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
