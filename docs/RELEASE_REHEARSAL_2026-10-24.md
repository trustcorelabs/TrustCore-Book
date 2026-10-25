# Release rehearsal — 24 October 2026

This report supersedes the database-target and migration-status assumptions in the earlier deployment audit. All release fixes remain local and uncommitted. Production has not been changed.

## Verified targets

- Development project: `divine-dawn-11566468`; parent `br-bold-heart-b42fnp9k` remains empty and unchanged.
- Migration/test child: `br-nameless-fog-b4cigm8d`, independently verified against project, organization, parent, endpoint and database metadata before fixture writes.
- Production: `quiet-mouse-55892784`, branch `br-autumn-queen-b50gugiv`, database `neondb`. Read-only checks found the matching initial migration, four pending migrations, no users/businesses/appointments, and seven rate-limit records. No migrations or credential changes have been performed there.

## Timeout diagnosis and fixes

Cold concurrent Prisma transactions failed with P2028 before acquiring a connection at the default two-second acquisition limit. A pool warm-up took 7,374 ms; the same transactions then passed unchanged. A ten-query read-only transaction failed at Prisma's five-second execution limit and passed with a bounded 15-second limit (5,297 ms total).

`src/server/repositories/database-client.ts` now centralizes the bounded pool and transaction settings for the application and integration suites. Regression coverage exercises concurrent cold acquisition and a multi-query transaction. The raw PostgreSQL constraint-test connection allowance also matches the bounded cold-connection allowance. No concurrency, authorization, overlap or rollback assertion has been removed. Booking confirmation also avoids loading the full schedule before acquiring the staff lock: it reads candidate IDs first and keeps the authoritative availability and server-price read under the lock, removing redundant relation queries.

The test-target allowlist now pins the approved rehearsal child and exact direct endpoint. Production, the development parent and substituted endpoints are rejected.

## Recovery drill: PASS

User-approved disposable branches were created only in the development project:

- Source: `br-wandering-surf-b4aged8c`, child of the migrated rehearsal branch.
- Recovered: `br-summer-fog-b4wwfe2e`, point-in-time child of the source at LSN `0/1D70F68`.

An earlier synthetic marker was committed, the recovery LSN captured, and a later marker committed. Read-only checks on the recovered branch found the earlier marker once, the later marker zero times, all five completed migrations, the enabled owner-protection trigger and the booking idempotency unique index. Both branches are retained.

Both projects advertise six hours of history retention. The tested recovery method creates a new branch rather than overwriting an original. A retained Production recovery branch still requires release approval and verification before Production migration. The isolated drill does not substitute for a Production backup.

## Release authorization boundary

No Production mutation, credential rotation, remote environment write, Git commit/push or deployment is authorized yet. Booking and membership must remain disabled. Hosted local email/outbox must remain disabled. Production account/workspace test records require explicit consent; an unconfigured email provider cannot establish successful email verification.

## Fresh Production read-only preflight

The public alias still resolves to Production deployment `dpl_54r5gmv3LXbqXbyGdEPAAQEWdtmB`, source `trustcorelabs/TrustCore-Book` commit `8dffe4e97effe80daf5bdf91ac62363b376708d0`. Vercel project `prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl` belongs to the expected team and has the Next.js framework preset. Production and Preview environment-variable inventories are both empty. Missing runtime configuration explains the live auth environment-validation failure; it does not establish hosted schema readiness.

Fresh read-only aggregate queries confirm zero existing users, businesses, staff, services, customers, appointments and sessions, with seven rate-limit records. Only the initial migration is applied, its checksum matches, and no unknown or unfinished migration is recorded. The four pending migrations remain unchanged.

The booking-idempotency migration has no explicit SQL transaction wrapper. Do not edit its already rehearsed checksum or blindly retry/resolve a partial failure; inspect migration history and use the retained recovery branch as needed. The other three pending migrations explicitly wrap their DDL in transactions. Production release requires a verified retained recovery point before any migration, short DDL lock allowance, and stopping on any ambiguous rotation/migration/deployment outcome.

The local Git origin names a different owner. Any approved push must explicitly target `https://github.com/trustcorelabs/TrustCore-Book.git` without changing the origin, and the resulting Production deployment must report the audited release commit. Local environment/context files and Vercel backup directories must be excluded from the release commit.

## Hosted test deadline diagnosis

A diagnostic copy, with unchanged assertions and timing-only instrumentation, executed 141 database queries in 92.5 seconds. All recorded availability calls returned valid results; its slowest query took 10.7 seconds. The compound status-management test failed under the controller's 60-second deadline. The timing and later fixture failures are consistent with unfinished asynchronous work racing subsequent fixtures/cleanup; the longer-deadline rerun is the confirmation gate. The full controller's 600-second process deadline was also shorter than the measured combined file durations.

The hosted verification runner therefore uses `--testTimeout=120000 --hookTimeout=120000` and a 900-second suite process bound. This is a test-journey allowance for multiple remote operations; production pool connections and transaction execution remain bounded at 15 seconds; total transaction acquisition is bounded at 30 seconds. Assertions, test concurrency and cleanup expectations are unchanged. Final sequential and normal-concurrency outcomes must both pass before release.

The first full normal-concurrency run with the longer test deadline passed all booking, identity, membership and raw constraint assertions (22/23 total). The only failure was the new concurrent cold-start regression: Prisma acquisition still expired at 15 seconds. Installed adapter source confirms acquisition awaits both `pool.connect()` and `BEGIN`, so sharing the pool's 15-second deadline creates a boundary race. The factory now allows 30 seconds for that combined acquisition path while retaining the 15-second pool connection and 15-second transaction-execution limits. The cold regression's outer test deadline covers those bounded stages and teardown; its assertions are unchanged.

## Continuation — 25 October 2026: sleep-related failures

The recovered final normal run was **20 passed, 3 failed, 0 skipped**. Cold acquisition, account security, membership and raw database constraints passed. The remaining booking failures returned generic unavailable results. No prior test processes were left running.

Temporary timing/error instrumentation (without changing repository assertions) captured availability connection timeouts, Prisma `P1001`, and a Staff query lasting 271.9 seconds. macOS power logs overlap these failures: the diagnostic ran through sleep/dark-wake transitions between 23:34 and 23:41 on 24 October. The long Staff query began around 23:34:21, immediately after sleep at 23:34:20. Availability errors at 23:40:09 coincide with dark wake after another sleep. These observations supersede an explanation based only on test deadlines or booking logic.

A separate **read-only** probe reproduced nine timeouts among ten concurrent `SELECT 1` transactions during maintenance sleep/dark-wake around midnight. A subsequent awake control passed **80/80 PostgreSQL transactions and 8/8 HTTPS read-only checks**, with maximum event-loop delay **56 ms**. No fixtures, schema or credentials were changed by these probes.

The remaining database verification is run with a process-scoped macOS assertion:

```sh
caffeinate -i -s node /tmp/trustcore-verify-database-release.mjs
```

This prevents idle/system sleep for that command's lifetime; no global power setting is changed. The verification runner independently rechecks the exact disposable branch identity before fixture writes and executes all assertions under normal concurrency and sequentially. No application timeout or assertion was changed during this continuation. Already-passed application builds/static checks are retained because application source is unchanged.

Full awake database results are pending below. Production changes remain unauthorized.

### Remaining execution timeout confirmed and repaired

Keeping the Mac awake removed sleep interruptions but did not eliminate every booking failure: a complete awake run still failed three booking assertions. A timed full run then passed 22/23 tests and captured the exact remaining error: **P2028, transaction expired**, with **365 ms acquisition** and **16,540 ms execution**. This was execution expiry, not an acquisition failure. Successful concurrent bookings had already measured 11.6–13.5 seconds, leaving little margin inside the inherited 15-second execution deadline.

`src/server/repositories/booking.ts` now supplies a **30-second execution deadline only for the booking transaction**, which performs serialized idempotency checks, locked schedule reads and atomic persistence/audit writes. The default 15-second pool connection limit, 30-second acquisition limit and 15-second execution limit for other transactions are unchanged. Prettier reindented the callback because the transaction now has an options argument; no locks, tenant checks, assertions, overlap constraints or rollback behavior were removed.

After this application-source change, TypeScript, ESLint, all **306 default tests** (25 gated skips), isolated production build, architecture boundaries and formatting passed again. The final full normal/sequential database verification must pass against this repaired source before a release can be approved.

## Authorized Production release — 25 October 2026

Final normal-concurrency and sequential verification both passed 23/23, with no failures or skips. The 306 default tests, TypeScript, ESLint, formatting, boundaries and isolated production build passed on the released application snapshot.

After explicit approval, retained Production recovery branch `br-muddy-boat-b53igbtp` was created and its original migration history and record counts verified. The exposed Production credential was rotated once. A first migration attempt stopped before Prisma started because its temporary workspace lacked package.json; no migration was applied by that attempt. The repaired workspace includes the package manifest, lockfile, Prisma configuration/schema/migrations and existing dependencies.

The resumed release independently verified Production identity and the retained recovery metadata without repeating rotation or creating branches. All four pending migrations applied; all five migration checksums, indexes, validated constraints and the enabled owner-protection trigger passed verification. Original aggregate counts remained unchanged. Approved Production runtime variables were configured separately from Preview, with booking/membership disabled and hosted local email/outbox disabled. No credentials are included in this report. Deployment and live smoke verification are recorded separately after completion.
