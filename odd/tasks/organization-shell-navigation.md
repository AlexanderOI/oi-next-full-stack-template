# Organization Shell Navigation

## Objective

Make the app header the only place where a signed-in user actively switches organizations, with a breadcrumb such as `oi-nextjs / Organization name / Panel`. Reorient the sidebar toward the selected organization without inventing incomplete organization-management pages.

## Accepted scope

The user selected a section-by-section delivery: implement the header and navigation first; editing organization details and organization-scoped role/permission UI are separate future sections. Existing member and invitation pages remain available. Do not relabel platform `/admin/users` or `/admin/roles` as organization management.

## Constraints and design

- Resolve selectable active memberships and the current selection on the server; never trust a slug from a client request. Pass serializable options to a small client selector in the header. No implicit selection; the existing Server Action validates membership and changes only the current session on explicit choice.
- Header breadcrumb uses the verified organization name and route-specific page label. For the selected organization, `Panel` navigates to `/org/[organizationSlug]`; do not mistake the global `/dashboard` placeholder for an organization dashboard.
- The header select is the only ordinary organization-switch control. The `/org` chooser, context mismatch/recovery UI, and invitation CTA must not mutate active organization outside that select; they may link/instruct the user to use it. Preserve all server-side context checks and safe recovery.
- Sidebar shows only existing authorized destinations for now: organization Panel, Invitaciones, Usuarios (members), and platform administration kept clearly separate. Organization editing and organization Roles entries are deferred until their real protected pages/actions exist; avoid dead links or misrepresenting platform routes.
- Keep EN/ES labels consistent; no database schema or migration changes, no push or PR.

## Acceptance criteria

- From any authenticated app page, a user can choose an active membership in the header and arrive at its canonical org landing; no organization is selected implicitly.
- Header renders brand, verified organization name, and correct current page crumb, including absent/stale active context without exposing an inaccessible slug.
- No second UI control switches the active organization. An invite recipient outside the app shell receives a safe path to the app header rather than an out-of-shell switch.
- Sidebar destinations use the selected org slug and scoped permissions; platform admin entries remain independent.
- Focused tests, type-check, lint, formatting, and diff checks pass; browser/DB validation limits are reported.

## Work units

- [x] ORG-SHELL-001 — Add a server-supplied header selector and breadcrumb with explicit switching, valid/null/stale-context and route-label tests. Code, translations, and tests committed together in `5c0f7a1`.
- [x] ORG-SHELL-002 — Remove duplicate organization switching from the authenticated chooser, org layout, and mismatch UI; retain safe no-active/mismatch/recovery paths with focused tests. Committed as `3f11b5c`.
- [x] ORG-SHELL-002B — Replace the out-of-shell recipient invitation switch action with navigation to the authenticated header selector; keep invitation security states and tests. Committed as `099a5b2`.
- [x] ORG-SHELL-003 — Align sidebar with existing selected-organization Panel, Invitaciones, and Usuarios destinations; keep platform administration separate and defer nonexistent edit/role pages. Committed UI labels and tests in `735541e`.
- [x] ORG-SHELL-004 — Independently verified the integrated shell and recorded checks, commits, and remaining browser/DB limits in this task evidence.

## Progress

- The header now renders the server-verified organization selector and route breadcrumb. Authenticated chooser/context screens are non-mutating; the public invitation page links to `/org` for selection in the header.
- The sidebar links only to existing selected-organization Panel, permission-gated Invitaciones and Usuarios, plus separate platform administration. The organization landing is a workspace page, not organization details editing; `/admin/roles` and `/admin/users` remain platform routes.

## Verification evidence

- ORG-SHELL-001: writer observed RED for missing selector/header props and five Panel-link cases, then GREEN. Independent verification passed 22 focused tests across four files, type-check without incremental cache, scoped ESLint, scoped Prettier, and `git diff --check`.
- The header receives the server-verified active ID and serializable active memberships; the selector calls the existing guarded Server Action only after user selection. The Panel crumb links to the selected organization from other pages, and null/stale IDs expose no tenant link.
- Commit `5c0f7a1`: `feat: add organization header selector and breadcrumb`.
- ORG-SHELL-002: a broad writer failed before source edits; the retry removed authenticated duplicate switches, localized chooser/context guidance, and added direct layout regression coverage. After deleting the now-unused switcher file, independent verification passed 27 tests in five files, type-check, scoped ESLint/Prettier, and diff checks. Commit `3f11b5c` records this unit.
- ORG-SHELL-002B: an invite recipient now follows a localized `/org` link rather than receiving a bound switch action. Independent verification passed 19 tests in three files, type-check, scoped ESLint/Prettier, and diff checks. Commit `099a5b2` records this unit.
- ORG-SHELL-003: the sidebar now shows only the selected organization's existing Panel, permission-gated Invitaciones and Usuarios, plus independent platform administration. Independent verification passed 19 tests in three files, type-check, scoped ESLint/Prettier, and diff checks. Commit `735541e` records this unit.
- ORG-SHELL-004: independent integration verification passed 64 focused tests across 11 files, type-check without incremental cache, scoped ESLint and Prettier on existing changed paths, and `git diff HEAD~4..HEAD --check`. Initial lint/format invocations included two intentionally deleted paths; reruns on existing changed paths passed. Read-only search found only the header selector invoking `switchOrganization` from client UI; protected route checks remained intact.
- No browser session, production build, full test suite, live database verification, or migration was run.

## Next step

Have the user confirm header selection and breadcrumb in a browser. Implement organization details editing and organization role/permission management as separately scoped future sections; do not relabel platform administration or publish without a separate decision.
