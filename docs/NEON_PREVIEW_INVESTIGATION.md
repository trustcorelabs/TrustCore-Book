# Neon Preview metadata investigation

Read-only checks performed on 24 October 2026 using the existing official Neon
CLI 8.11.1 OAuth session. No login was initiated. No credential files or `.env`
files were opened by the investigation. CLI output was captured and only
allowlisted metadata was displayed. Existing `.neon` was inspected as metadata
and preserved: its only key is `orgId`, set to `org-broad-lab-06866989`.

## Verified access

- Existing CLI identity authenticated successfully.
- Organization listing returned only TrustCore Labs (`org-broad-lab-06866989`).
- Explicit GET `/projects/fragrant-hat-50630079` returned HTTP 404.
- The organization project listing returned `quiet-mouse-55892784` and
  `polished-block-78280084`. The protected project's name/ID appeared only in
  this organization-level listing; no request targeted its project routes.
- Shared-project listing returned an empty list.
- Unscoped account-project listing returned HTTP 400. It was not treated as an
  empty account listing; explicit organization and direct-project requests above
  establish the current access limits.

HTTP 404 does not establish whether the expected project was deleted, belongs
to another identity/organization, or is inaccessible to this OAuth identity.
There is no evidence that the expected development target was independently
verified earlier; older repository notes describe it as prepared/unverified.
Another login attempt cannot be assumed to resolve this discrepancy.

## Existing candidate: not approved as development

| Metadata                   | Observed value                                             |
| -------------------------- | ---------------------------------------------------------- |
| Project ID and name        | `polished-block-78280084`                                  |
| Owning organization        | `org-broad-lab-06866989`                                   |
| Region / PostgreSQL        | `aws-us-east-2` / 18                                       |
| Project created            | `2026-10-18T06:15:54Z`                                     |
| Project updated            | `2026-10-18T06:16:01Z`                                     |
| Only branch                | `br-patient-darkness-b4u5937n`, named `production`         |
| Branch properties          | primary/default, not protected, creation source `console`  |
| Branch updated             | `2026-10-18T13:14:55Z`                                     |
| Database                   | `neondb`, bound to the above branch                        |
| Database created / updated | `2026-10-18T06:15:54Z`                                     |
| Endpoint                   | `ep-billowing-poetry-b4946u67`                             |
| Endpoint host              | `ep-billowing-poetry-b4946u67.c-6.us-east-2.aws.neon.tech` |
| Endpoint ownership         | exact candidate project and branch IDs above               |
| Endpoint state             | read/write, enabled, idle                                  |
| Endpoint created / updated | `2026-10-18T06:15:54Z` / `2026-10-18T06:21:01Z`            |

This confirms ownership of infrastructure, not its purpose, data contents or
suitability as an isolated development environment. Neither an idle endpoint nor
a branch named `production` proves usage. No database connection was opened and
no schema/data query was run. No connection URI, password or role-secret endpoint
was requested. This project must not be automatically selected for Preview.

## Decision and approval boundary

Initial decision: keep hardcoded target IDs and Preview configuration unchanged. Propose
a fresh, isolated `trustcore-book-dev` project under TrustCore Labs, in
`aws-us-east-2`, without cloning either existing project. Creation requires
explicit approval. After creation, verify returned organization, project,
branch, endpoint and database metadata before updating the helper's target
allowlists. No migrations, seeds, password rotation, Vercel writes or deployment
are included in creation approval.

## Approved creation and verified replacement

The owner subsequently explicitly approved creation of the fresh development
project. One official CLI project-create request was executed with `--no-secrets`
and `--no-set-context`, followed by independent metadata GETs:

| Metadata           | Verified value                                         |
| ------------------ | ------------------------------------------------------ |
| Project name / ID  | `trustcore-book-dev` / `divine-dawn-11566468`          |
| Organization       | `org-broad-lab-06866989` (TrustCore Labs)              |
| Region             | `aws-us-east-2`                                        |
| Created            | `2026-10-24T15:39:55Z`                                 |
| Branch             | `br-bold-heart-b42fnp9k`, named `main`                 |
| Parent branch      | none; created independently, not cloned                |
| Endpoint ID        | `ep-ancient-unit-b45mjtvt`                             |
| Endpoint hostname  | `ep-ancient-unit-b45mjtvt.c-6.us-east-2.aws.neon.tech` |
| Endpoint ownership | exact new project and branch above, enabled read/write |
| Database           | `neondb`, bound to the new branch                      |

The Preview helper and independent metadata verifier now share this exact target
allowlist, including organization and endpoint ID/hostname. Original project
routes remain refused. The old expected project also remains refused. Existing
`.neon`, `.env.local`, Codex configuration and Git branch were not changed.
Other historical migration/outbox rehearsal guides still target the unavailable
old project and are not authorization to use the new one.

No password was displayed or retrieved by the investigation. Project creation
provisions an initial credential, but no existing role password was reset. No
SQL connection, migration, seed, Vercel environment write or deployment occurred.
The schema is not integration-verified; booking and membership remain disabled.

Official references: [organization listings](https://neon.com/docs/cli/orgs),
[project listings and creation](https://neon.com/docs/cli/projects),
[authenticated API requests](https://neon.com/docs/cli/api),
[local context](https://neon.com/docs/cli/set-context).
