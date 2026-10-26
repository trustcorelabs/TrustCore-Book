# Targeted database reliability investigation — 26 October 2026

## Decision and root-cause limits

Release-policy follow-up: [PRODUCTION_RELEASE_DECISION_20261026.md](PRODUCTION_RELEASE_DECISION_20261026.md) supersedes the earlier release-blocking assessment with conditional READY FOR APPROVAL and explicit residual-risk acceptance. The causal investigation remains inconclusive; none of its findings or historical failures is erased.

**BLOCKED for a causal reliability fix.** The current monitored run is healthy, but no application defect or precise cause of the historical timeout has been established. Do not claim a fix merely from another green run. No configuration change is justified by this evidence.

The historical confirmed category remains a 15,000 ms pg-pool acquisition/checkout timeout. The earlier instrumentation did not separate queue wait from connection establishment, so it cannot retrospectively prove which phase consumed that deadline. In particular, the checkout timer can include creation of a new connection after a queued request is dispatched; its message alone does not prove that the five-connection pool was full.

This investigation did not reproduce that failure. Current measurements do not support attributing it to a leaked Prisma client, pool capacity exhaustion, a Neon connection limit, a schema error, compute suspension, or a specific TCP/TLS/PostgreSQL startup phase. An intermittent infrastructure/network delay remains a possibility, not a proven Neon outage. No timeout, pool size, endpoint assignment or business-rule assertion was changed.

## Scope and safeguards

Before every database probe or fixture run, read-only Neon metadata independently verified organization `org-broad-lab-06866989`, project `divine-dawn-11566468`, disposable branch `br-nameless-fog-b4cigm8d`, expected parent, endpoint `ep-rapid-lake-b406ul3l`, role and database `neondb`. Direct and pooled URIs came from that project's connection-URI API and were individually bound to that exact endpoint; TLS verification remained enabled. Credentials stayed in child-process memory. No existing environment or credential files were read.

Direct/pooled comparison used hardcoded read-only SELECT statements only. The single affected suite used existing approved synthetic fixture writes and cleanup. All execution was bounded and sleep-prevented with caffeinate. No migrations, projects/branches, credential changes, Production access, Vercel writes, commits, pushes or deployments occurred.

Compute metadata reported current state `idle` before the probes, raw `suspend_timeout_seconds=0`, and min/max compute 0.25 CU. A successful readiness probe followed; this is not proof that suspension caused the historical failure. Endpoint metadata was fetched using the [official read-only API](https://api-docs.neon.tech/reference/getprojectendpoint).

## Phase-separated evidence

Temporary isolated diagnostics recorded:

- Each pool request's initial/dispatch/completion counts and queue duration.
- Physical client creation, TCP connection, TLS secure connection and PostgreSQL-ready timing, linked by numeric request/client identifiers.
- Query round-trip timing, release/removal events and error codes/categories.

No SQL text, SQL parameters, arbitrary error messages, addresses, URLs, credentials, tokens or customer details were logged. TCP/TLS/PostgreSQL-ready measurements below are cumulative from connection creation, not additive phase durations. Query timing includes network round trips; it is not a claim about server CPU execution alone.

| Probe                                                           | Result                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Direct read-only checks                                         | 12/12 PASS; six fresh connections                                                   |
| Pooled read-only checks                                         | 12/12 PASS; six fresh connections                                                   |
| Direct maximum TCP / TLS / PostgreSQL-ready                     | 412 / 1,032 / 1,991 ms                                                              |
| Pooled maximum TCP / TLS / PostgreSQL-ready                     | 362 / 1,106 / 2,121 ms                                                              |
| Probe queue dispatch                                            | At most 1 ms on either endpoint                                                     |
| Direct / pooled maximum SELECT round trip                       | 369 / 408 ms                                                                        |
| Affected booking suite                                          | **8/8 PASS**, 0 skipped, approximately 102.1 seconds excluding setup/cleanup        |
| Suite acquisition                                               | 143 requests; median 1 ms, maximum 2,108 ms                                         |
| Suite queue dispatch / pre-creation queue                       | Both at most 4 ms                                                                   |
| Suite TCP / TLS / PostgreSQL-ready maxima                       | 375 / 1,023 / 2,102 ms                                                              |
| Suite query round trip                                          | 365 operations; median 303 ms, maximum 3,322 ms                                     |
| Acquisition, establishment, transaction or query-timeout events | **0**                                                                               |
| Suite pool peak                                                 | Four physical connections; configured limit five                                    |
| Independent cleanup and migration checksums                     | **PASS** before/after; all seven checksums and original aggregates/digest unchanged |

Both endpoint types were tested in alternating order, with cold and warm three-client bursts. Neither failed. The pooled endpoint was not consistently faster; no endpoint switch is justified. These bounded successful samples do not prove that intermittent transport issues cannot recur.

## Lifecycle, concurrency and limits

- Prisma adapter-pg constructs an owned pg Pool. Its disposal path awaits `pool.end()`; no external-pool ownership option is used by the application.
- The application caches one Prisma client in globalThis. The affected fixture creates one client, shares it through the mocked repository accessor and awaits disconnect in teardown.
- The affected suite ran with exactly one Vitest worker. No stale reliability/booking test runner was found before starting; unrelated development processes were preserved.
- Availability reads use the existing shared pool outside a transaction. Booking creation and rescheduling retain their existing transactions and deadlines.
- Ten-second idle eviction and 15-second connection/acquisition timeout were preserved. Idle removal/reconnection occurred normally; no leak or incorrect lifecycle transition was demonstrated.
- PostgreSQL reported max_connections 112, four reserved slots, and no additional role/database connection cap (both -1). The initial three-client probe saw three database connections and zero idle transactions.
- Final read-only inspection found two other client backends and zero idle transactions. They were not terminated. Backend count alone cannot establish ownership or prove that these are stale Prisma clients; server-side pooling can retain backend sessions after clients disconnect. No leak is claimed from this aggregate.

## Changes and evidence

Application, dependency, test and configuration source: **unchanged**. Temporary instrumentation was removed from the isolated snapshot; sanitized artifacts remain locally. Unrelated passing TypeScript, lint, unit and build checks were reused.

Evidence files: `/tmp/trustcore-reliability-probes.json`, `/tmp/trustcore-reliability-probes.jsonl`, `/tmp/trustcore-reliability-suite.json`, `/tmp/trustcore-reliability-suite.jsonl`, `/tmp/trustcore-reliability-timing-summary.json`, `/tmp/trustcore-reliability-postcheck.json`.

Documentation and the release inventory were updated only. The original Production baseline remains untouched.

## One next action

Capture one recurrence with this phase-separated diagnostic method on the verified disposable connection path and obtain a transport/provider explanation before proposing a causal configuration fix. No further retry or arbitrary application change is performed in this bounded investigation.
