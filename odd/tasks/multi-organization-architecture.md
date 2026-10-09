# Multi-Organization Architecture Document

## Objective

Create a detailed, implementation-ready architecture document for multi-organization support without changing application behavior or implementing code.

## Problem and rationale

The template currently uses global users, roles, permissions, invitations, and authorization snapshots. The requested design must support global identities with multiple organization memberships, organization-scoped administration, self-service organization creation, administrator-provisioned users, immutable organization restrictions with explicit allowlist exceptions, and organization context in both the session and URL.

## Authorized scope

- Document the target domain model and invariants.
- Document self-registration, administrator provisioning, invitations, allowlist, suspension, organization deletion, active-organization switching, roles, permissions, and auditing.
- Document the Better Auth Organization integration boundary.
- Map current repository ownership paths to the future implementation.
- Define implementation work units, test strategy, acceptance criteria, rollout/reset strategy, and known decisions.

## Explicit non-goals

- No application code, schema, migration, test, configuration, or dependency changes.
- No database reset or generated migration.
- No commit, push, pull request, or merge without explicit authorization.
- No preservation or backfill of existing database data; this template may reset its database when implementation begins.

## Confirmed product decisions

- A global identity may belong to multiple organizations.
- Email and username remain globally unique.
- Public self-registration creates a personal organization from the username and makes the user its owner.
- Administrator-provisioned users start only in the administrator's active organization and do not receive a personal organization.
- Administrators with a protected permission may mark a newly provisioned user as organization-restricted.
- The base restriction is immutable; allowed additional organizations are explicit allowlist exceptions.
- A restricted user cannot receive or accept an invitation from an organization outside the allowlist.
- Protected role definitions are global; custom roles are organization-owned.
- Suspending a user with one active membership suspends the identity globally; with multiple memberships it suspends only the selected membership.
- Deleting an organization deletes identities whose only membership is in that organization.
- If a restricted user has other allowlisted memberships when the managing organization is deleted, the identity continues only in those organizations, loses its managing organization, and cannot expand its frozen allowlist.
- The active organization is stored in the session and represented in the URL; both must agree.
- Existing data need not be migrated because the template database may be reset.

## Tasks

- [x] **MO-DOC-001 — Define the target model and security invariants**
  - Route: delegated via `gentle-ai-worker`.
  - Outcome: an explicit model for organization, membership, invitation, roles, allowlist, active context, account state, and audit boundaries.
  - Checks: every confirmed decision maps to a model invariant and ownership rule.

- [x] **MO-DOC-002 — Define flows, edge cases, and implementation work units**
  - Route: delegated via `gentle-ai-worker`.
  - Outcome: detailed happy paths, failure paths, concurrency rules, deletion/suspension behavior, repository impact, phased implementation, and test matrix.
  - Checks: no unresolved flow silently relies on the current global authorization behavior.

- [x] **MO-DOC-003 — Verify documentation completeness and consistency**
  - Route: delegated via `gentle-ai-verify` if command execution or independent verification is required; otherwise structural readback.
  - Outcome: the architecture document is internally consistent, implementation-ready, and clearly separates decisions from recommendations.
  - Checks: Markdown structure, terminology consistency, product-decision coverage, Better Auth boundary, and explicit non-goals.

## Acceptance criteria

1. A developer can implement the feature without reconstructing requirements from conversation history.
2. The document distinguishes global identity state from organization membership state.
3. Restricted-user allowlist semantics remain enforceable during invite creation and acceptance.
4. Session and URL organization context have one deterministic consistency rule.
5. Role, permission, suspension, deletion, and last-owner rules are scoped correctly.
6. Repository paths and feature ownership follow `AGENTS.md`.
7. The document includes testable acceptance criteria and a complete scenario matrix.
8. No application behavior is changed.

## Progress

- Repository and current single-tenant assumptions analyzed.
- Product decisions captured.
- `docs/architecture/multi-organization.md` created and formatting verified.
- Independent structural review findings were corrected and independently reverified.
- The final document is implementation-ready; only explicitly labeled product recommendations and numerical limits remain open.

## Verification evidence

- Current schema and authorization snapshot are global and contain no organization context.
- Better Auth Organization officially supports organizations, memberships, invitation accept/reject/cancel/expiry, active organization state, role hooks, and lifecycle hooks.
- A one-organization restriction with allowlist exceptions is product-specific and requires custom validation around invite/member operations.
- Independent verification confirmed the documented Better Auth 1.6.25 boundaries for `disabledPaths`, global `hooks.before`, and `disableOrganizationDeletion` against installed runtime and types.
- `bunx prettier --check docs/architecture/multi-organization.md odd/tasks/multi-organization-architecture.md` passed.
- `git diff --check` passed.
- No runtime RED/GREEN cycle applied because this change only creates passive architecture documentation.
- No commit was created because repository delivery was not authorized.

## Next step

Obtain product decisions for the explicitly open recommendations, then begin the first implementation work unit only under separate implementation authorization.
