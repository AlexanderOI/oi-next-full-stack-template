# Guarded Organization Switch

## Objective

Fix the explicit personal-organization selection failure `ORGANIZATION_ENDPOINTS_UNAVAILABLE` without exposing blocked Better Auth organization endpoints.

## Cause and constraints

The product switch action validates an active membership and then invokes `auth.api.setActiveOrganization`. The global Better Auth `before` guard blocks every `/organization/*` endpoint, including this direct API invocation. Broadly unblocking the stock HTTP endpoint would weaken the product-owned authorization boundary. Keep stock endpoints blocked, preserve explicit-only switching, update only the authenticated current session, and fail safely on concurrent changes or lost membership. No database migration or external publication.

## Acceptance criteria

- The current user can explicitly switch to an active organization, including from a null active context.
- Inactive/non-member targets and unauthenticated callers cannot alter session state or receive an organization URL.
- A concurrent session-context change does not get overwritten; a failed conditional update returns a safe failure.
- Selecting the already-active organization remains idempotent after membership validation.
- Stock `set-active` remains forbidden over HTTP and direct `auth.api` calls.
- Focused tests, type-check, lint, formatting, and diff checks pass; DB integration limits are reported.

## Tasks

- [x] ORG-SWITCH-001 — Replace the blocked stock API call with a current-session/user/observed-context conditional update and test switch, denial, null context, concurrency, and stock-endpoint guard; reconcile architecture documentation. Behavior, tests, and docs committed together in `3880cfa`.
- [x] ORG-SWITCH-002 — Independently verified 27 focused tests and static checks, recorded work-unit evidence and limits, and committed this task record.

## Progress

- Read-only incident trace found the product action passes its active-membership check, then the global auth guard rejects its direct `auth.api.setActiveOrganization` call. The chooser itself is not the cause.
- The existing stale-context recovery action demonstrates a conditional current-session update pattern. The architecture's numbered switch contract permits this persistence change; its Better Auth ownership note needs reconciliation.

## Verification evidence

- Writer observed RED in two new switch tests before replacing the blocked API call; the focused two-file Vitest run passed 16 tests after implementation. A direct `bun test` attempt failed because Bun's runner could not resolve the mocked `server-only` module; the configured Vitest runner was used instead.
- Independent verification passed 27 tests in five files (switch, stock guard, organization shell, navigation, and switcher), `bunx tsc --noEmit --incremental false`, scoped ESLint, scoped Prettier, and `git diff --check`.
- Work-unit commit `3880cfa` contains the guarded switch, regression tests, and corrected architecture wording.
- The CAS was tested with mocked persistence, not a live PostgreSQL transaction. Membership loss between verification and update was not tested atomically; route authorization continues to fail closed. No browser retry, full suite, production build, migration, or live database operation was run.

## Next step

Have the user retry organization selection in the browser. If the error persists, inspect the actual session and database update without bypassing authorization. Before broader delivery, run the full suite/build and a PostgreSQL integration check. Do not run migrations or publish without a separate decision.
