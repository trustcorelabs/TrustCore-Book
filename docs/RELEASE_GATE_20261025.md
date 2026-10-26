# Coordinated Production release gate — 25 October 2026

**Current decision: READY FOR APPROVAL, conditional on explicit residual-risk acceptance. See [PRODUCTION_RELEASE_DECISION_20261026.md](PRODUCTION_RELEASE_DECISION_20261026.md) for the sole current approval scope and stop conditions. Earlier blocking assessments below are historical and superseded; no failure or unresolved root cause is reclassified as fixed. No Production action is authorized yet.**

## Existing live baseline (read-only verified)

- URL: https://trustcore-book-psi.vercel.app
- Deployment: `dpl_AzYMr4c3jFmDjfDQUyt7txDbwHrK` (Production, Ready).
- Baseline/local HEAD/requested GitHub main: `63aed13557a48c45b89b07c329903acbe65d031a`.
- Vercel: `trust-core-labs/trustcore-book`, project `prj_Mr6OKvaya0bgukmh5R5ljZDd0OXl`; logged-in CLI account `trustcorelabs-6758`.
- Next.js framework, default Next.js output, Node 24.x, frozen pnpm install, `pnpm build`: verified.
- Git integration: `trustcorelabs/TrustCore-Book`, Production branch `main`. A future push can automatically deploy; do not also issue a duplicate manual deployment.
- Local `origin` still points to `Dashin-sanjana/TrustCore-Book`. It was not changed. Any approved push must explicitly target the verified `trustcorelabs/TrustCore-Book` repository, rechecking its main SHA first and never forcing.
- Production variable names/presence only: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, BOOKING_MVP_ENABLED, A2_MEMBERSHIP_ENABLED, ACCOUNT_EMAIL_PROVIDER, LOCAL_OUTBOX_ENABLED, LOCAL_OUTBOX_TARGET_APPROVED. No values were retrieved; presence does not verify their contents.

## Mandatory development gate

Latest bounded follow-up: [BOOKING_AVAILABILITY_DIAGNOSIS.md](BOOKING_AVAILABILITY_DIAGNOSIS.md). Single regression **1/1 PASS**, affected suite **8/8 PASS**, independent cleanup **PASS**. A pg-pool acquisition timeout was nevertheless captured during the suite under `caffeinate`; connection health remains **FAIL**. Earlier failed results below are retained as historical evidence, not current assertion counts. No application source or timeouts were changed.

Metadata independently verified project `divine-dawn-11566468`, disposable branch `br-nameless-fog-b4cigm8d`, parent `br-bold-heart-b42fnp9k`, direct endpoint, database `neondb` and owner role before fixture writes.

- All seven applied migration checksums, schema guards and consent default: PASS.
- Independent cleanup verification before retry: PASS, resolving the previous API-timeout blocker.
- Exactly one bounded retry of `issues a private management capability for a real idempotent booking`: **FAIL**, 0 passed, 1 failed; seven other cases deliberately unselected. Failure occurred after about 24 seconds at `expect(slots.error).toBeUndefined()`, receiving `Availability is temporarily unavailable.` No assertions or connection limits were relaxed.
- Earlier attempt recorded a pg-pool connection timeout. The current availability handler catches all exceptions and does not retain the cause; therefore the current result cannot conclusively be classified as a network failure rather than source failure. No further retry was started.
- Independent cleanup after retry: **PASS**. All seven checksums match and original totals/digest are unchanged (1 user, 2 businesses, 2 services, 1 staff member, 6 customers, 6 appointments, 14 audit entries).
- Previously passing delivery/billing tests: **6/6**, reused; not rerun. External delivery remains synthetic only.

Current-source isolated offline verification: Prisma generation PASS, ESLint PASS, **348 unit tests PASS / 0 FAIL / 39 gated tests skipped**, production build PASS, architecture boundaries PASS. TypeScript PASS reused from the latest matching application-source checkpoint. The old 342-test/35-screenshot UI report remains historical evidence, not new-feature browser verification. No long database suites or new Production smoke fixtures were run.

Private evidence: `/tmp/trustcore-release-gate.json`, `/tmp/trustcore-release-cleanup-readonly.json`, `/tmp/trustcore-release-offline.json`, `/tmp/trustcore-release-recovery-metadata.json`, `/tmp/trustcore-release-vercel-link.json`. These contain sanitized metadata/results only; connection credentials stayed in memory.

## Recovery and migration risk review

Production project/org metadata matched `quiet-mouse-55892784` / `org-broad-lab-06866989`. Existing recovery branch `br-muddy-boat-b53igbtp` exists, parent `br-autumn-queen-b50gugiv`, created `2026-10-25T05:00:19Z`, fork LSN `0/1E67D28`. It is **not** a current pre-release recovery point. Project history retention reports 21,600 seconds (six hours); do not treat that as coverage back to the old fork time.

After explicit approval and restored gates, create a retained child branch from the exact Production parent's current head using Neon's supported create-branch operation, initially without a compute endpoint. Independently verify returned project/parent/fork LSN/timestamp and recovery availability before migration. Do not restore over active Production automatically. Official reference: https://api-docs.neon.tech/reference/createprojectbranch

The two new migration candidates are:

1. `20261025010000_booking_product_core`: policy/buffer/catalog/snapshot/idempotency additions, occupancy backfill from unchanged historical start/end values, occupancy trigger and stronger exclusion constraint.
2. `20261025020000_delivery_and_sandbox_ledger`: durable queue and TEST-only payment/subscription ledger tables; customer email consent defaults false.

Both use explicit transactions, five-second lock timeouts and 120-second statement timeouts. The first includes an UPDATE of existing appointment occupancy columns and scans/index construction; it is not a zero-lock operation. Production migration history, endpoint/role/database identity, existing overlap integrity and checksums must be reverified read-only immediately before any approved migration. They were deliberately not newly connected or migrated after the failed development gate. No claim is made that Production history was reverified in this run.

Additive columns preserve the old application's data contract; the occupancy trigger supplies required fields for old inserts. Keep booking OFF during migration/rollback. Retain schema additions on application rollback; never run destructive down migrations. New package/add-on catalog records and nonzero buffers introduce semantic differences for the old UI/booking engine, so freeze those edits during rollback evaluation. Rollback must use the verified known-good Vercel deployment without overwriting newer database records. Tenant-bound foreign keys, buffered exclusion and server authorization remain; passing unit tests alone do not waive the failing booking gate.

## Single consolidated approval scope — prepared, not requested or authorized

Only after the mandatory gate is resolved and the candidate is finalized:

1. Create and verify one fresh current-head Production recovery branch; retain it. No new project or credential rotation.
2. Apply only the two named rehearsed migrations, in order, if freshly verified Production history proves they are the only pending compatible migrations. No reset, seed or record deletion.
3. Preserve Production DATABASE_URL and existing Auth.js origin/secret. Do not connect development to Production. Set/confirm only safety controls: BOOKING_MVP_ENABLED=false, A2_MEMBERSHIP_ENABLED=false, BILLING_SANDBOX_ENABLED=false, APPOINTMENT_NOTIFICATIONS_ENABLED=false, APPOINTMENT_EMAIL_DELIVERY_ENABLED=false, ACCOUNT_EMAIL_PROVIDER=disabled, LOCAL_OUTBOX_ENABLED=NO, LOCAL_OUTBOX_TARGET_APPROVED=NO. No provider credentials added.
4. Create one reviewed commit from the release-only inventory, excluding environment/Neon/Vercel backup files and unrelated work; push explicitly to verified `trustcorelabs/TrustCore-Book main` without force after checking remote ancestry.
5. Let the existing Git integration deploy that exact commit once. Verify commit/project/deployment/alias, sanitized runtime readiness, disabled endpoints and approved-account smoke tests. No new Production accounts/workspaces or password resets are included.
6. If live checks fail, stop mutations and evaluate application-only rollback to the known-good deployment. Recovery/restore over newer records requires separate review and approval.

No current release commit or new deployment exists. No Production database, environment, credential, Git branch/remote, commit, push or deployment was changed. Source changes in this release-gate step are documentation only. Local secrets, `.env.local`, `.neon` and MCP configuration were not read or modified.

## Next required action

Obtain the single consolidated approval in PRODUCTION_RELEASE_DECISION_20261026.md. The latest health-clean bounded run satisfies the operational pre-release check; proving a causal fix for every historical transient is not an additional automatic gate. Residual uncertainty must be explicitly accepted, and any newly observed release-time instability still stops execution. No further diagnostics are started by this decision.
