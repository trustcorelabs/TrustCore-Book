# Delivery and sandbox ledger rehearsal — 2026-10-25

Scope: explicitly approved disposable development branch only.

- Organization: `org-broad-lab-06866989`
- Project: `divine-dawn-11566468`
- Branch: `br-nameless-fog-b4cigm8d`
- Parent: `br-bold-heart-b42fnp9k` (unchanged)
- Database: `neondb`

## Verified results

- Independent project/branch/endpoint/database/role metadata verification: PASS before migration and fixture writes.
- Six previously applied migration checksums: PASS.
- `20261025020000_delivery_and_sandbox_ledger`: APPLIED on the disposable branch only. All seven migration checksums subsequently matched.
- Post-migration existing-data preservation: PASS. Existing totals were 1 user, 2 businesses, 2 services, 1 staff member, 6 customers, 6 appointments and 14 audit entries. Appointment time/price/status digest unchanged.
- Six ledger/job tables, five composite tenant foreign keys, both TEST-only constraints and non-null email consent defaulting to false: PASS.
- Original and buffered appointment exclusion constraints and occupancy trigger: PASS.
- Synthetic notification/billing integration: **6 passed, 0 failed, 0 skipped**. Coverage: default consent, notification deduplication, retry/opt-out, tenant foreign keys, TEST-only constraints, payment reservation/replay/event reconciliation, refund limits, one-use trial, quotas and expiry/cancellation downgrade.
- Booking product regression suite: **7 passed, 1 failed**. Failure: `issues a private management capability for a real idempotent booking` hit `timeout exceeded when trying to connect` in pg-pool. It is not recorded as PASS.
- Synthetic cleanup hooks: completed without hook failures, scoped to this run's generated fixture IDs. Final independent aggregate/digest verification after cleanup: initially blocked; subsequently **PASS** during the coordinated release gate, including after its failed targeted retry.
- Isolated TypeScript: PASS.
- Relevant unit tests: **20 passed, 0 failed, 0 skipped** across five files.
- ESLint and formatting for files changed in this step: PASS.
- Architecture boundaries and Git whitespace check: PASS.

## Safety and implementation

The notification worker now accepts an optional business scope, applied to claims and expired leases. Synthetic delivery is restricted to the run-specific `example.invalid` recipient. External HTTP calls are blocked in the integration test process. No emails or payment-provider requests were sent.

The missing rescheduling notification enqueue hook was connected. Test doubles now return an audit event ID; the package-duration assertion reflects the fixture's actual 90-minute package plus 10-minute add-on. Connection timeouts and test assertions were not weakened.

No Production/parent-branch changes, credential rotation, Vercel writes, deployment, commit or push occurred. Existing local environment files were not read or changed.

## Remaining blocker and next action

The attempt to rerun only the failed booking test stopped at its mandatory read-only metadata gate, before any further fixture writes. A subsequent read-only check also timed out: Neon CLI API request to the approved branch's database metadata, 60-second timeout (`ETIMEDOUT`, process terminated by timeout). This is not evidence of an authorization failure or a schema defect.

When Neon metadata access is responsive, independently reverify target identity and compare post-cleanup aggregates/digest to the pre-run baseline. Then rerun only the single failed booking regression. Do not reapply the migration or repeat the six passing delivery/billing tests. Production release remains unauthorized by this rehearsal approval.

## Coordinated release-gate follow-up

See [RELEASE_GATE_20261025.md](RELEASE_GATE_20261025.md). The single permitted targeted retry failed at the availability assertion (generic handled error, underlying exception not logged). It is not converted to PASS. Read-only final cleanup verification subsequently passed: all seven migration checksums and original aggregates/digest match. Production changes remain blocked.

## Bounded acquisition diagnosis follow-up

Single booking regression 1/1 PASS; affected booking suite 8/8 PASS; independent cleanup PASS. A 15,000 ms pg-pool acquisition timeout was captured during the suite under caffeinate, so Production remains BLOCKED despite functional PASS. See [BOOKING_AVAILABILITY_DIAGNOSIS.md](BOOKING_AVAILABILITY_DIAGNOSIS.md). No application source, timeout or assertion changed; no further retry was started.
