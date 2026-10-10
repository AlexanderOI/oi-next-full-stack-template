# Tenant-Only Administration

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

- TENANT-ADMIN-002a: Admin grant parity and signup compatibility written test-first (observed three RED failures; 16 GREEN tests). Independent verifier confirms 16 tests, type-check, Prettier, scoped lint and diff checks pass, but mocks do not establish real DB predicates or bootstrap persistence. Owner-only lifecycle changes remain pending; do not deploy this partial slice alone. Work-unit commit pending.
- TENANT-ADMIN-001: source-based inventory and non-destructive compatibility/rollout proposal recorded in `docs/architecture/tenant-administration-transition.md`; no live database touched. Independent read-only verification found no material factual problems. Scoped Prettier passed; `git diff --check` passed but does not include these still-untracked documents. No behavior tests apply to this documentation-only work unit. Work-unit commit: `b96f047`.

## Next step

Implement TENANT-ADMIN-002 test-first: full-access Admin policy and signup compatibility while preserving existing Owner assignments. Do not apply database changes.
