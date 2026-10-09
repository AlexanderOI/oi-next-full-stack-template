# Organization Navigation

## Objective

Make a newly registered personal-organization owner able to discover and use their organization workspace from the application navigation, without granting platform administrator permissions.

## Problem and rationale

The sidebar displays Dashboard and Profile unconditionally but gates its only administration section on platform permissions. Public signup assigns the user an organization owner membership and role, not a platform administrator role. Organization pages exist but are undiscoverable from the sidebar.

## Scope and constraints

- Add organization navigation to the existing app shell; keep platform Roles/Users independently gated by platform permissions.
- Resolve membership and active organization on the server. Pass only serializable, verified values to the client sidebar; never trust an unverified active organization ID or infer organization permissions from platform authorization.
- Always offer the authenticated `/org` chooser, including for users with no active membership.
- Offer active-workspace and member/invitation destinations only for a verified active membership and the corresponding organization-scoped read grants. Destination routes retain their own server authorization.
- Keep the patch limited to app-shell composition/navigation, translations, and focused tests. Do not alter signup roles, bootstrap policy, migrations, or database state.
- Do not push or open a PR.

## Acceptance criteria

- A freshly registered owner can navigate to their organization workspace and its authorized member/invitation pages from the shell.
- With no active organization or an invalid/stale active ID, no tenant-specific link exposes a slug; `/org` remains available.
- Organization membership does not reveal platform admin Roles/Users, and platform admin permissions do not imply tenant links.
- Navigation behaves correctly for partial member/invitation read grants.
- Focused tests, type-check, lint, and diff checks pass; limitations are recorded.

## Tasks

- [x] ORG-NAV-001 — Add a server-validated organization navigation snapshot and render an organization section in the sidebar; drive regression tests RED/GREEN and preserve platform navigation boundaries. Behavior, tests, and translations committed together in `0ca8b86`.
- [x] ORG-NAV-002 — Independently verified the focused behavior, type-check, lint, formatting, and diff; recorded commit `0ca8b86` and the remaining validation limits in this task evidence.

## Progress

- Read-only diagnosis found organization owner and platform administration are distinct; the sidebar exposes only platform administration. Existing `/org` chooser and organization-scoped route guards are the correct destination.
- Read-only exploration identified the app layout, sidebar, localized shell labels, and focused component/route tests as bounded edit surfaces.

## Verification evidence

- Writer observed RED in four layout regression cases before implementation; after implementation the focused two-file suite passed 9/9.
- Independent verification after the formatting correction passed the same 9/9 tests, `bunx tsc --noEmit --incremental false`, scoped ESLint, scoped Prettier, and `git diff --check`.
- Commit `0ca8b86` contains the server-derived organization navigation, client sidebar links, localized labels, and focused tests. Platform administration remains independently permission-gated.
- No browser session, full test suite, production build, live-database check, or migration was run. Existing organization-specific route guards remain the server authority.

## Next step

Have the newly registered owner confirm the organization links in a browser. Before delivery, run the broader suite/build and, when authorized, validate migrations and authorization behavior against PostgreSQL. Do not publish or modify the database without a separate decision.
