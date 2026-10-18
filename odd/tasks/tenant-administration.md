# Tenant-Only Administration

Branch: `feat/multi-organization`. Delivery: independently verified work-unit commits; no publishing or live database writes.
Runner: `bun run test:run`; focused Vitest paths, type-check, lint and formatting per unit.

## Specs

- S1 — Current authorization, verbatim: "Has lo que falta si tienes la documentacion suficiente".
- S2 — Requested context, verbatim: "Quiero que ,e digas el estado del proyecto y en que quedamos en la ultima seseion".
- Existing accepted behavior and safety requirements are preserved below in Confirmed product decisions, Constraints and safety, and Acceptance criteria, with the detailed compatibility contract in `docs/architecture/tenant-administration-transition.md`. These are prior recorded decisions, not newly invented verbatim user quotations.

## Tasks

- TENANT-ADMIN-001 | S1 | inline, complete | `b96f047`.
- TENANT-ADMIN-002a | S1 | complete | `9388ccc`.
- TENANT-ADMIN-002b | S1 | inline, blocked: required independent verifier admission denied | commit pending. Risk: item 2 (authorization); item 4 (concurrent administrator continuity).
- TENANT-ADMIN-002c | S1 | pending, route determined after mapping | commit pending.
- TENANT-ADMIN-003 | S1 | pending, route determined after mapping | commit pending.
- TENANT-ADMIN-004 | S1 | pending, route determined after mapping | commit pending.
- TENANT-ADMIN-005 | S1 | pending, depends on 003/004 | commit pending.
- TENANT-ADMIN-006 | S1 | pending, route determined after mapping | commit pending.
- TENANT-ADMIN-007 | S1 | independent verifier, pending | commit pending.

## Log

### L1 — Current continuation request (verbatim)

"Has lo que falta si tienes la documentacion suficiente"

### Resume reconciliation

The full Engram observation #324 matches the preserved historical plan and commit evidence below. Search reports pending conflict annotations without alternative content; no unseen alternative is treated as authority. Git has five pre-existing modified files (task file, deletion/member helpers and their tests); preserve and verify them, without claiming earlier RED/GREEN evidence for this unfinished unit. Previous original feature-request wording is unavailable in this resumed context; do not fabricate it. Read-only mapping delegated because the remaining cross-feature security transition exceeds one bounded read batch.

### Current verification and blocker

- Mapping confirms 003/004 share authorization boundaries and must not use parallel writers on overlapping files. 006 is independent only after 002c retires transfer UI.
- `bun run test:run tests/server/organizations/manage-organization-members.test.ts tests/server/organizations/delete-organization.test.ts`: exit 0, 39 tests passed in two files. This is current GREEN evidence only; no new RED claimed.
- `bun run type-check`, scoped ESLint and Prettier on the four candidate source/test paths, and `git diff --check`: all exit 0.
- ASSESS returned high risk via item 2 escalation; writer self-verification and a separate independent verifier are required. `reviewDue: false`, `reviewDueReason: under_budget`, RDD off.
- Required verifier launch was denied by runtime admission despite the task explicitly naming Risk items 2 and 4. Exact response: "An independent verifier runs only for a change that declares a named high-risk item (`Risk: item N` from the Task Size list in the task). This change declares none: run its focused test and suite inline yourself now; do not retry the launch, and never add a Risk line or create a feature document only to get a verifier admitted."
- No retry, bypass, commit, or further source changes. Unit remains unverified independently; no live DB or race proof. Human decision needed to restore verifier admission before resuming security-sensitive implementation. Full suite and remaining feature work have not been run/completed.

### Preserved historical plan and evidence

## Objective

Replace product-facing platform-wide administration with organization-scoped administration. A self-registered user owns a personal organization as its full-access Admin. Initially only Admin and Member are protected organization roles; Admin can create custom organization roles and manage users in that organization. Reuse the existing `/admin/roles` and `/admin/users` page experiences, scoped to the selected organization. Group the crowded organization components by responsibility.

## Confirmed product decisions

- There is no product-facing sysadmin with authority over every organization's users or roles.
- One full-access organization Admin replaces the distinct Owner product role. The personal-organization creator starts as Admin, including organization deletion and custom role/user management. The former ownership-transfer action is retired: Admin assignments are managed from Users, with no surviving organization left without an active Admin.
- Member is the other initially protected organization role. Custom roles belong to a specific organization.
- Reuse the existing role and user administration pages/components rather than building parallel organization-only implementations. Routes may remain `/admin/roles` and `/admin/users`, but server data/actions must be tenant-scoped.
- `src/features/organizations/components/` is reorganized into responsibility folders such as `dialogs/`, `pages/`, and `tables/` as appropriate, without speculative empty folders.

## Constraints and safety

- Existing registered users and organization data must be preserved. Do not reset the database, apply migrations or bootstrap against live data, or run remote delivery commands as part of code verification.
- Current organization Owner/Admin and platform assignments may exist. Do not delete them or silently change grants until an explicit, reviewed compatibility mapping/backfill exists. Transition code must fail closed for missing or inconsistent assignments.
- Server Actions and queries must derive/validate active organization and membership and reject cross-tenant role IDs, user IDs, and mutations. Client navigation is not authorization.
- Existing `/admin` pages currently exercise platform permissions and broad data access; do not relabel them without converting all reads and writes.
- Keep review units small, tests and docs beside behavior, and report migration and browser/DB verification limits.

## Acceptance criteria

- A new registrant receives full Admin access only within the personal organization, including organization users and custom roles.
- Members and custom-role holders receive only their organization-scoped grants; one organization's Admin cannot enumerate or mutate another's users or roles.
- Existing admin pages and components operate on the active organization; no platform-wide product administration is reachable through them.
- Former Owner/Admin assignments are mapped safely without losing existing organizations, identities, or sessions; migrations/rollout are documented before application.
- Organization components are in responsibility-named subdirectories, and public feature boundaries remain valid.

## Work units

- [x] TENANT-ADMIN-001 — Establish a read-only inventory of role/assignment consumers, existing data shape, bootstrap effects, and migration order; finalize compatibility contract and security tests before altering authorization.
- [ ] TENANT-ADMIN-002 (in progress) — Add the full-access organization Admin policy and non-destructive compatibility path for existing Owner/Admin assignments, with signup/bootstrap/action tests; produce migrations only if necessary, do not apply them.
  - [x] 002a — Protected Admin grant parity and personal signup Admin, preserving legacy Owner retries.
  - [ ] 002b — Admin-sensitive deletion and last-Admin continuity, with legacy Owner compatibility.
  - [ ] 002c — Retire ownership-transfer action/UI and Owner invitation choice without opening direct-action bypasses.
- [ ] TENANT-ADMIN-003 — Make `/admin/roles` and existing role manager/actions tenant-scoped, including custom-role CRUD and cross-tenant denial tests.
- [ ] TENANT-ADMIN-004 — Make `/admin/users` and existing user manager/actions tenant-scoped, including provisioning, membership-role assignment, access control, and cross-tenant denial tests.
- [ ] TENANT-ADMIN-005 — Remove product-facing platform admin navigation/authorization only after tenant paths are functional and validated; preserve data during any transition.
- [ ] TENANT-ADMIN-006 — Reorganize organization components into responsibility directories with imports/public exports and structural tests or checks, without behavior changes.
- [ ] TENANT-ADMIN-007 — Independently verify the integrated candidate, record commits, skipped browser/DB checks, and a safe non-destructive rollout plan.

## Progress

- Read-only exploration confirmed current signup assigns protected Owner, not Admin. The current Admin lacks owner-sensitive permissions. Existing `/admin/roles` and `/admin/users` read platform roles/users and cannot be safely reused by changing labels alone.
- The user explicitly chose a single full-access Admin product role. Existing data may already contain Owner/Admin assignments, so preserve and map it; no database reset is authorized.
- The user explicitly retired ownership transfer; administration changes belong in the reused Users page, protecting the last active Admin. No new transfer control or Owner invitation is to be offered.

## Verification evidence

- TENANT-ADMIN-002a: Admin grant parity and signup compatibility written test-first (observed three RED failures; 16 GREEN tests). Independent verifier confirms 16 tests, type-check, Prettier, scoped lint and diff checks pass, but mocks do not establish real DB predicates or bootstrap persistence. Owner-only lifecycle changes remain pending; do not deploy this partial slice alone. Work-unit commit: `9388ccc`.
- TENANT-ADMIN-001: source-based inventory and non-destructive compatibility/rollout proposal recorded in `docs/architecture/tenant-administration-transition.md`; no live database touched. Independent read-only verification found no material factual problems. Scoped Prettier passed; `git diff --check` passed but does not include these still-untracked documents. No behavior tests apply to this documentation-only work unit. Work-unit commit: `b96f047`.

## Next step

Implement TENANT-ADMIN-002 test-first: full-access Admin policy and signup compatibility while preserving existing Owner assignments. Do not apply database changes.
