# Deployment audit — 24 October 2026

Target: https://trustcore-book-psi.vercel.app. All fixes in this audit are local,
uncommitted and undeployed. No Vercel settings, feature flags or database schema
were changed. No remote database connection or live account/booking mutation was
attempted. Database fixtures used only the guarded, managed local cluster.

## Live observations

- `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`,
  `/verify-email` and `/invitations` rendered their expected public pages.
- `/api/auth/providers` and `/api/auth/session` returned HTTP 500 with no response
  body exposing a stack or connection string. The supplied Vercel runtime-log
  screenshot confirms `Server environment is incomplete. See .env.example.`
- `/onboarding`, `/app`, `/app/audit-nonexistent/services`, `/account` and `/admin`
  rendered the generic error boundary instead of a login redirect. These streamed
  responses had HTTP 200; their rendered content was an error, not a working
  authenticated workspace. No tenant data was displayed.
- `/api/dev/outbox`, `/.env` and `/debug` returned HTTP 404. `/dev/outbox` rendered
  the app's not-found page (streamed HTTP 200). No outbox contents were exposed.
- Public pages included `X-Content-Type-Options: nosniff` and
  `X-Frame-Options: DENY`.
- Empty login/register submissions made no POST requests. Password visibility
  toggled correctly. Validation text exposed Zod's technical default wording.
- Nine full-page screenshots cover home, login and register at 375, 768 and 1440
  pixels. None had horizontal document overflow. Live screenshot files are
  `/tmp/trustcore-live-{home,login,register}-{375,768,1440}.png`.

The environment error precedes database access. It identifies neither the exact
invalid variable nor the correct Neon endpoint. This is not evidence of a missing
migration or of a successful Neon connection.

## Implemented fixes

| File                                      | Change                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/auth-form.tsx`            | Disable credential fields until hydration and during submission, prevent duplicate clicks, preserve retry values, associate validation errors with fields, announce failures, use 16px mobile input text, colour success/error notices, and explain the JavaScript requirement. |
| `src/lib/validation.ts`                   | Replace technical login/registration validation text with actionable messages while retaining password and UTF-8 limits.                                                                                                                                                        |
| `src/lib/env.ts`                          | Log only invalid variable names; retain generic exceptions and required configuration checks.                                                                                                                                                                                   |
| `src/app/api/auth/[...nextauth]/route.ts` | Contain thrown configuration/dispatch failures in redacted, uncached HTTP 503 responses; preserve throttling and existing authentication.                                                                                                                                       |
| `src/app/error.tsx`                       | Provide a home-page recovery link instead of sending users back into the failing workspace route.                                                                                                                                                                               |
| `src/app/book/[slug]/page.tsx`            | Allow long service names to wrap within flex cards.                                                                                                                                                                                                                             |
| `tests/auth-form.test.tsx`                | Cover accessible validation, pending submission locking and retry recovery.                                                                                                                                                                                                     |
| `tests/auth-route.test.ts`                | Cover configuration and asynchronous dispatch failures without leaking details.                                                                                                                                                                                                 |
| `tests/env.test.ts`                       | Cover diagnostic redaction and production HTTPS enforcement.                                                                                                                                                                                                                    |
| `tests/e2e/booking-journey.spec.ts`       | Check mobile drawer navigation and layout overflow; capture staff, appointment and public-booking screenshots at all three requested widths.                                                                                                                                    |
| `docs/VERCEL_DEPLOYMENT.md`               | Correct intended repository/team/domain and document safe runtime configuration diagnosis.                                                                                                                                                                                      |

## Security and configuration review

The installed package is NextAuth v4, using Credentials and JWT cookies with
server-side revocable sessions. Secure cookies are enabled in production.
Repositories validate session expiry, revocation and tenant membership; owner/
admin checks protect writes. Permission and cross-tenant tests passed. There is
no need to replace the authentication implementation or introduce a Prisma auth
adapter. Prisma uses the Node PostgreSQL adapter, a reused client and a bounded
connection pool. The build generates the client without applying migrations.

Local email delivery requires development mode, a loopback application origin,
explicit approval settings and verified target metadata. Its API additionally
requires host/origin matching and a bearer token. Unsupported email providers
remain unconfigured. No hardcoded development login or public mock-auth bypass
was found in `src`. Hosted database accounts were not inspected, so the absence
of a seeded account in that database is not established.

Booking and membership gates require the exact string `true`; missing settings
fail closed. Both persistent local flags remained false. Booking was enabled
only inside the isolated test server after schema and integration gates passed.
The live deployment's flag values cannot be established from public pages.

The code expects the separate development Neon project
`fragrant-hat-50630079`, branch `br-dark-brook-b4vdolwu`. This is an expected
identity from the guards, not independently verified deployment metadata.
Neither that project nor the original production database was connected to.
Hosted migration status remains unknown. The local runner verified five existing
completed migrations, the booking request table and the exclusion constraint;
it did not apply migrations.

## Final verification

| Check                                        | Result                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                                       | Passed (`pnpm lint`).                                                                                                                                      |
| Unit/default suite                           | 208 passed, 23 skipped; 41 test files passed and 5 skipped. Database suites are gated in this run.                                                         |
| Guarded local database suite                 | 21 passed across 4 files, with isolated fixtures. Covers overlap/concurrency, idempotency, transaction rollback, sessions and membership.                  |
| Guarded browser suite                        | 8 passed, 0 retries, desktop and mobile Chromium, 46.2 seconds.                                                                                            |
| TypeScript                                   | Passed (`pnpm typecheck`) in a separate temporary source copy.                                                                                             |
| Production build                             | Passed (`pnpm build`, webpack) in that copy with dummy unreachable database configuration and booking/membership disabled. No live configuration was used. |
| Architecture boundaries                      | Passed.                                                                                                                                                    |
| Changed TypeScript formatting and whitespace | Prettier and `git diff --check` passed.                                                                                                                    |

The full browser journey registered a random account, onboarded a business,
created a service and staff member, configured 09:15 working hours and time off,
booked a valid 45-minute appointment, observed it in the dashboard, verified
that overlapping slots disappeared, cancelled it, rebooked, and completed the
second appointment. Mobile navigation and overflow assertions passed. The test's
`finally` cleanup removes its own random fixture graph.

Nine fixture screenshots are under
`test-results/booking-journey-registrati-ea541-dashboard-status-management-chromium/`:
`staff`, `appointments` and `public-booking`, each with `-375.png`, `-768.png` and
`-1440.png`. These are local development-server screenshots, not live Vercel
workspace evidence. The screenshot caret option preserves original styles to
avoid test-induced hydration warnings.

A separate local smoke test ran the production build with an intentionally empty
auth secret. Auth providers/session returned redacted HTTP 503 with `no-store`,
the outbox API returned 404, and server diagnostics named only `NEXTAUTH_SECRET`.
With JavaScript disabled, credential fields and submit were disabled. Updated
validation screenshots at all three widths showed no overflow:
`/tmp/trustcore-fixed-validation-{375,768,1440}.png`.

The Prisma/pg stack emitted a non-failing concurrent-client-query deprecation
warning during database/browser tests. The current pinned dependencies passed;
future pg major upgrades need compatibility verification.

## Remaining deployment blockers

1. At least one of `DATABASE_URL`, `NEXTAUTH_URL` or `NEXTAUTH_SECRET` is missing
   or invalid in the active Vercel deployment. The required public origin is
   `https://trustcore-book-psi.vercel.app`; the secret must be at least 32
   characters. The updated diagnostic will identify invalid key names after an
   explicitly authorized deployment, without logging values.
2. Vercel environment scope and Neon project/branch/endpoint binding remain
   unverified. The supplied screenshot contains runtime errors, not database
   metadata. Do not connect to an endpoint based only on a pasted URL.
3. Hosted schema and booking integration gates remain unverified. Leave hosted
   booking/membership flags false. Do not apply pending migrations without
   verified development identity and explicit migration authorization.
4. Applying these local fixes, changing hosted settings or publishing a new
   deployment requires the user's authorization. This audit made none of those
   changes.
