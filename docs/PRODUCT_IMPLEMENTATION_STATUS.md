# Product implementation checkpoint — 25 October 2026

Current release status: **READY FOR APPROVAL**, conditional on explicit residual-risk acceptance and execution-time recovery/identity/schema checks. See [PRODUCTION_RELEASE_DECISION_20261026.md](PRODUCTION_RELEASE_DECISION_20261026.md). The historical acquisition timeout remains unexplained; it is not claimed fixed.

All changes in this checkpoint are local. The current redesigned Preview source is retained. No Production database, credentials, flags, environment variables or deployment are changed.

| Capability                                                             | Actual implementation                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication, account/session controls, onboarding                   | Existing implementation retained                                                                                                                                                                                                                                                                                                                                                                |
| Services, staff schedules/time off, customer directory, status changes | Existing implementation retained                                                                                                                                                                                                                                                                                                                                                                |
| Light/dark design                                                      | Royal-blue/off-white content and navy sidebar; layered navy dark surfaces                                                                                                                                                                                                                                                                                                                       |
| Calendar                                                               | New tenant-scoped day/week/month views, staff/status filters, detail dialog, recurring-hours/time-off context and mobile agenda. Existing status actions only; gated same-professional rescheduling with original duration/price preserved; no drag-to-reschedule or creation bypass                                                                                                            |
| Reporting                                                              | New business-local date windows (up to 93 days), counts, cancellation/no-show rates, service popularity, completed service minutes; no revenue or capacity-utilization claims                                                                                                                                                                                                                   |
| CSV                                                                    | Manager-only, tenant-filtered appointment report; spreadsheet formula escaping; no export of truncated datasets                                                                                                                                                                                                                                                                                 |
| Customer profile/history                                               | New tenant-scoped contact profile and latest 100 visits; appointment-email consent storage now exists; broader notes/preferences remain unimplemented                                                                                                                                                                                                                                           |
| Audit viewer                                                           | New manager-only searchable latest 100 workspace events                                                                                                                                                                                                                                                                                                                                         |
| Public booking                                                         | Existing gated transaction/idempotency/overlap engine retained; refined portal, themes and sticky summary; no payments collected                                                                                                                                                                                                                                                                |
| Team lifecycle                                                         | Existing feature-gated implementation retained; not enabled                                                                                                                                                                                                                                                                                                                                     |
| Account emails                                                         | Existing Resend/gateway adapters retained; hosted local outbox denied; provider not configured                                                                                                                                                                                                                                                                                                  |
| Appointment reminders                                                  | Durable tenant-scoped jobs and bounded lease/retry worker implemented and tested with synthetic delivery. Consent defaults false. No scheduler or real delivery enabled                                                                                                                                                                                                                         |
| Payments                                                               | Disabled-by-default provider contract, exact two-decimal money conversion and a tenant-bound Stripe test-key-only Checkout adapter for AE/AU. Raw-body HMAC test-event authentication is unit-tested. Gated test webhook, durable replay/payment/refund reservation ledger now implemented; no operational public checkout, merchant provisioning, live settlement or external refund execution |
| Subscriptions                                                          | Synthetic TEST-only trial/subscription ledger and gated quotas implemented; no real provider subscription integration or paid entitlements activated                                                                                                                                                                                                                                            |
| Remaining booking gaps                                                 | Signed seven-day customer management links support lookup and one-hour-notice cancellation; manager rescheduling is integrated with calendar behind the booking flag. Customer self-service rescheduling, configurable buffers/policies, categories/packages/add-ons now have code and disposable-branch coverage; booking release gate still fails. Waitlists remain unimplemented             |
| Optional growth                                                        | Categories/packages now have additive schema and management UI. Notes, promotions/reviews/loyalty, multi-location and POS remain unimplemented                                                                                                                                                                                                                                                  |

## Provider eligibility research (official sources)

- UAE / Australia: Stripe lists these as supported merchant countries: <https://stripe.com/global>. Test onboarding, country/currency support and the platform/connected-account model still require verification for the actual business. Do not assume one platform account can collect for every tenant.
- Sri Lanka: PayHere merchant application is available to eligible Sri Lankan businesses, subject to onboarding: <https://support.payhere.lk/application-process>.
- Maldives: Bank of Maldives provides merchant gateway services, subject to bank application and approval: <https://www.bankofmaldives.com.mv/business-and-sme/business-banking-services/merchant-services>.
- Sri Lanka and Maldives must not be silently routed through a Stripe merchant account in another country. No live gateway has been activated. The restricted Stripe sandbox adapter is not connected to a public action and has only mocked-provider tests pending real test credentials.

Stripe API references: <https://docs.stripe.com/api/checkout/sessions/create> and the official signature implementation <https://github.com/stripe/stripe-node/blob/master/src/Webhooks.ts>.

No live payment/email success is claimed. A production provider, verified sandbox credentials, approved operational provider wiring, customer cancellation/refund rules and tenant merchant ownership remain prerequisites before external financial endpoints can be enabled. No historical migration is rewritten to accommodate these features.

Calendar and report truncation is explicit (2,000 and 10,000 rows respectively). Customer history and audit views are bounded. Working-hours overlays are recurring wall-clock schedules, not a claim that a time is available for booking; the existing booking engine is authoritative.

## Verification results

| Check                             | Result                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Prisma client generation          | PASS                                                                                        |
| TypeScript                        | PASS; final browser-test edits also rechecked                                               |
| ESLint                            | PASS; final browser-test edits also rechecked                                               |
| Default Vitest suite              | 342 PASS, 0 FAIL, 30 gated database tests skipped                                           |
| New database integration suite    | 5 PASS, 0 FAIL, 0 skipped; 115.4 seconds                                                    |
| Migration integrity               | All five applied migration names/checksums verified read-only                               |
| Isolated production build         | PASS (`next build --webpack`), with unreachable synthetic database configuration            |
| Architecture boundaries           | PASS                                                                                        |
| Formatting / diff whitespace      | PASS                                                                                        |
| Real Chromium development journey | 1 PASS, 0 FAIL, 0 skipped, 0 flaky; 436.0 seconds                                           |
| Responsive checks                 | No horizontal overflow at 375, 430, 768, 1280 and 1440px; mobile navigation exercised       |
| Screenshots                       | 35 actual browser captures, including light/dark dashboard and portal at every tested width |

Database tests and the browser journey used only the independently verified disposable development branch `br-nameless-fog-b4cigm8d` in `divine-dawn-11566468`. Synthetic fixture cleanup completed. Production, the development parent, credentials and remote feature flags were unchanged. No schema migration, commit, push or deployment was performed.

The real browser journey covered registration/automatic login, onboarding, service creation, staff/service assignment, seven-day schedules, time off, available-slot selection, booking confirmation, overlap removal, signed anonymous lookup/cancellation, cancelled-slot release after a fresh lookup, a second booking, dashboard status changes, calendar details, date-filtered reports, customer visit history and audit navigation. Week/month calendar calculations and DST boundaries have unit coverage; the real calendar browser check used day view. Manager rescheduling, conflicting concurrent moves and tenant isolation have database integration coverage.

Earlier browser attempts stopped at cold route compilation, slow remote mutations, pending staff refreshes and a subsequent in-tab slot lookup. The last attempt passed with explicit save-completion waits, pending-state protection and a fresh customer lookup after cancellation. The earlier in-tab zero-slot result was not independently attributed to a source defect; the passing result does not establish its exact cause. No transaction timeout or functional assertion was relaxed. Representative mobile light and desktop dark screenshots were visually inspected; this is not a full WCAG audit or verification of every optional module.

Private-run summaries are retained locally at `/tmp/trustcore-product-checks.json`, `/tmp/trustcore-product-db-checks.json` and `/tmp/trustcore-product-e2e-checks.json`. Browser images are under `/private/var/folders/k1/s87x51f54hqb0f3g3btps_gc0000gn/T/trustcore-product-browser-DNJa7h/test-results/`. They are local verification artifacts, not a newly deployed Preview.

## Changed-file inventory

This current local diff includes the retained Preview redesign and this implementation checkpoint. Local environment, Neon metadata and Vercel backup files are excluded.

- `docs/PRODUCT_IMPLEMENTATION_STATUS.md`
- `next.config.ts`
- `src/app/api/businesses/[businessId]/reports/route.ts`
- `src/app/app/[businessId]/[section]/page.tsx`
- `src/app/app/[businessId]/audit/page.tsx`
- `src/app/app/[businessId]/calendar/page.tsx`
- `src/app/app/[businessId]/customers/[customerId]/page.tsx`
- `src/app/app/[businessId]/layout.tsx`
- `src/app/app/[businessId]/page.tsx`
- `src/app/app/[businessId]/reports/page.tsx`
- `src/app/book/[slug]/page.tsx`
- `src/app/globals.css`
- `src/app/manage-booking/page.tsx`
- `src/app/page.tsx`
- `src/app/payments/return/page.tsx`
- `src/components/activity-overview.tsx`
- `src/components/auth-layout.tsx`
- `src/components/business-form.tsx`
- `src/components/dashboard-view.tsx`
- `src/components/data-table.tsx`
- `src/components/module-directory.tsx`
- `src/components/module-placeholder.tsx`
- `src/components/product-preview.tsx`
- `src/components/record-form.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/feedback.tsx`
- `src/components/ui/page-heading.tsx`
- `src/components/workspace-nav.tsx`
- `src/features/appointments/reschedule-form.tsx`
- `src/features/booking-engine/slots.ts`
- `src/features/calendar/calendar-view.tsx`
- `src/features/calendar/dates.ts`
- `src/features/public-booking/booking-form.tsx`
- `src/features/public-booking/manage-booking.tsx`
- `src/features/registry.ts`
- `src/features/reporting/metrics.ts`
- `src/features/reporting/report-view.tsx`
- `src/features/staff/staff-editor.tsx`
- `src/server/actions.ts`
- `src/server/booking-management-token.ts`
- `src/server/booking-management.ts`
- `src/server/insights.ts`
- `src/server/notifications/contracts.ts`
- `src/server/payments/gateway.ts`
- `src/server/payments/stripe-sandbox.ts`
- `src/server/public-booking.ts`
- `src/server/queries.ts`
- `src/server/repositories/booking-management.ts`
- `src/server/repositories/insights.ts`
- `src/server/repositories/rescheduling.ts`
- `src/server/rescheduling.ts`
- `tests/booking-capability.test.ts`
- `tests/business-form-hydration.test.tsx`
- `tests/calendar-dates.test.ts`
- `tests/calendar-view.test.tsx`
- `tests/dashboard-view.test.tsx`
- `tests/disabled-integrations.test.ts`
- `tests/e2e/booking-journey.spec.ts`
- `tests/e2e/database.ts`
- `tests/insights-authorization.test.ts`
- `tests/insights-repository.test.ts`
- `tests/marketing-design.test.tsx`
- `tests/notification-policy.test.ts`
- `tests/product-database.integration.test.ts`
- `tests/report-metrics.test.ts`
- `tests/staff-editor-pending.test.tsx`
- `tests/stripe-sandbox.test.ts`
- `tests/workspace-nav-hydration.test.tsx`
