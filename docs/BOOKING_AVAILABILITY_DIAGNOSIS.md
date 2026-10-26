# Booking availability blocker — bounded diagnostic run

## Latest follow-up — 26 October

See [DATABASE_RELIABILITY_20261026.md](DATABASE_RELIABILITY_20261026.md): direct/pooled probes 24/24 PASS; affected suite 8/8 PASS; phase-separated acquisition health and cleanup PASS. No application defect or historical causal trigger was reproduced, so no speculative pool/timeout change was made. The causal reliability investigation remains BLOCKED; earlier measured failures below are retained as history.

## Decision

**BLOCKED: intermittent pool acquisition remains unstable.** No Production changes or new approval request. Do not interpret passing functional assertions as a clean infrastructure gate.

## Evidence and confirmed category

Both runs used `caffeinate -i` with finite assertion lifetimes and bounded test execution. Before each run, independent Neon metadata verified project `divine-dawn-11566468`, disposable branch `br-nameless-fog-b4cigm8d`, its expected parent, direct endpoint, database `neondb` and owner role. All seven migration checksums and original data aggregates/digest matched.

Instrumentation existed only in isolated temporary snapshots. It preserved timeout values, business logic, return values and assertions. It separately measured pg Pool.connect acquisition and pg Client.query execution, recording only elapsed times, pool counts, fixed error categories/codes and source-frame locations. No SQL text, parameters, URLs, tokens, credentials or customer details were logged.

| Check                                       | Result                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Exact single booking regression             | **PASS: 1 passed, 0 failed**, seven unrelated cases unselected                               |
| Directly affected booking integration suite | **PASS: 8 passed, 0 failed, 0 skipped**, approximately 306.8 seconds excluding setup/cleanup |
| Independent cleanup after each run          | **PASS**, original aggregates and appointment digest unchanged                               |
| Migration integrity                         | **PASS**, all seven checksums match                                                          |
| Connection health inside affected suite     | **FAIL**, one pool acquisition timed out after **15,000 ms**                                 |

The timeout was recorded by the pool-connect callback at `pg-pool/index.js:45`, before the caller acquired a client. This confirms **pool checkout/acquisition timeout**, rather than an observed statement timeout, Prisma P1001/P2028, invalid schema or business-rule rejection. It occurred with sleep prevention active. The precise cause of that acquisition delay (network/Neon connection establishment versus pool queue scheduling) remains unproven; do not describe it as a confirmed Neon outage, sleep issue or application deadlock.

The single regression did not reproduce the generic unavailable response. Its acquisition maximum was 7,446 ms; query execution maximum 2,354 ms. In the affected suite, 143 acquisitions had median 0 ms and maximum 15,000 ms; 350 query executions had median 649 ms and maximum 6,008 ms. Expected exclusion/FK errors (23P01/23503) were observed in negative constraint tests. No availability-caught exception was captured in these successful functional runs, so the earlier generic response cannot independently be tied to a specific exception from this run.

The eight-test suite includes expected-rejection assertions. An acquisition failure can be consumed by such a path; aggregate PASS does not prove a health-clean run. The raw diagnostic failure is therefore retained as a release blocker rather than waived.

## Lifecycle and minimal-change assessment

The fixture creates one Prisma client with a maximum of five connections, shares it through its mocked repository accessor and disconnects in teardown. The application uses a lazily cached singleton. Existing idle eviction is 10 seconds. Availability reads are outside a transaction; booking creation and rescheduling use their existing transactions. No leaked-client or excessive-pool-size defect was established. Measurements include fresh connection costs separately from query execution.

No application source, timeout, pool size or test assertion was changed. A source-level fix is not justified by this evidence. Blindly increasing connection or transaction deadlines would conceal the remaining instability.

Temporary database/availability instrumentation was removed from both owned snapshots after the runs. Only sanitized timing and result artifacts remain under `/tmp/trustcore-availability-*`; none is part of the release application. No local environment, Neon metadata, MCP configuration, Git branch or remote configuration was changed. Production was not connected or modified. No unrelated build, lint or unit suites were repeated; their previous results remain applicable because application source is unchanged.

## One next action

Establish a health-clean connection path to the verified disposable Neon endpoint and rerun this affected suite once with acquisition monitoring before requesting the consolidated Production approval. No further retry is performed in this run.
