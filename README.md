# TrustCore Book

TrustCore Book is a multi-tenant booking SaaS built as **one Next.js App Router application**. Next.js serves both the frontend and backend through pages, server components/actions, and API routes. There is no separate NestJS server.

## What is in this project

The restored application contains authentication and account management, business onboarding, tenant authorization, team membership, services, staff, availability, customers, appointments, a public booking flow, dashboards, and a loopback-only development email outbox. These are code features, not a claim that a new database or live booking flow has been verified. The five forward-only Prisma migrations are preserved in `prisma/migrations`.

The [feature requirements](docs/FEATURES.md) and [booking rollout guide](docs/BOOKING_MVP_ROLLOUT.md) describe additional release gates. Payments, subscription billing, multi-branch operations, and advanced analytics are not part of the verified MVP.

## Local setup

For a local PostgreSQL database on your own Mac (PostgreSQL 16+ binaries must
be on `PATH`), run:

```sh
pnpm install --frozen-lockfile
pnpm setup:local
pnpm dev
```

Open `http://localhost:3000/register`. Create an account with a password of at
least 12 characters; you will be signed in and taken to business setup.
Returning users can sign in at `/login`. No email provider is needed.
After restarting your Mac, run `pnpm setup:local` again before `pnpm dev`.
It preserves accounts, starts a separate PostgreSQL cluster on port 55432,
applies migrations only to that cluster, and writes a private `.env.local`.
Local data and secrets are excluded from Git. It refuses to replace an existing
environment configuration or use exported database URLs. Stop this database
with `pg_ctl -D .local/postgres stop`.

For an externally hosted development database, use the following procedure.

Use Node.js 22.12+ and pnpm. Install dependencies with `pnpm install --frozen-lockfile`. Copy `.env.example` to a local environment file only after independently verifying a disposable development database. Do not use a production or shared Neon URL. Set `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_URL`, and a new random `NEXTAUTH_SECRET` in your own local environment; never commit them.

`DATABASE_URL` is the application connection. `DIRECT_URL` is used by Prisma CLI commands. Neither has a repository fallback. The development email outbox requires its explicit provider and safety configuration; see [local integrations](docs/LOCAL_DEVELOPMENT_INTEGRATIONS.md) and [separate development project](docs/SEPARATE_DEV_PROJECT.md).

```sh
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Open `http://localhost:3000`. Pages can render without a database, but registration, login, and booking require a verified, migrated development target. `pnpm build` generates the Prisma client; it does not apply migrations.

## Database safety

Do not run `prisma db push` or `prisma migrate reset`. Apply the existing migrations only after confirming the exact Neon project, branch, endpoint, database, and migration history, and explicitly authorizing writes to that target. Keep `A2_MEMBERSHIP_ENABLED` and `BOOKING_MVP_ENABLED` off until their migration and test gates pass. No database is configured or migrated by rebuilding this repository.

The unit suite is designed to run without a live database. Database and browser integration tests require separate, independently verified disposable fixtures. See the rollout documents before enabling them. Never use a previously shared credential; rotate exposed credentials first.

## Booking workflow verification

With the existing managed local database running, use `pnpm test:local`.
This verifies the exact loopback cluster data directory, all five migration
records and the booking schema before creating randomized test fixtures. It
never creates a database or applies migrations. Fixtures are removed after each
suite; existing accounts and businesses are preserved. Google Chrome must be
installed for the desktop and mobile browser tests.

The runner first tests database constraints, identity, membership, booking
concurrency, idempotency, rollback, tenant boundaries and stale availability.
Only after these pass does its separate browser-test server enable booking,
on port 3100 with its own `.next-booking-test` output. The browser journey
registers an owner, onboards a business, adds a service and staff member,
configures hours and time off, books as a customer, and manages the appointment
in the dashboard. Both persistent feature flags remain false.

Production builds use Next.js's supported Webpack option because Turbopack's
CSS worker cannot bind its evaluation port in this environment. Development
continues to use the existing Next.js development command.

Local verification does not certify the separate Neon development project.
Use the read-only `pnpm dev:check` with fresh credentials and Neon metadata
before authorizing any migrations there. Integration and browser test gates
reject the former project's endpoint. Never enable persistent booking on Neon
until that exact target passes its schema and integration gates.
