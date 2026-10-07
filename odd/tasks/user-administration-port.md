# User Administration Port

## Objective

Port the uncommitted user-administration capability from `/home/alexa/projects/ai/talents-ai` into this template while preserving this repository's architecture and excluding source-project-specific CV/AI behavior.

## Problem and rationale

The source repository was derived from this template and now contains uncommitted work for user invitations, access activation/deactivation, role-aware administration, and invitation-aware password setup/reset. The target should regain those reusable template capabilities with behavior and UI kept as close to the source as its current code permits.

## Authorized scope

- User administration list, filters, columns, actions, and invitation dialog.
- Invitation creation/resend and access activation/deactivation.
- Invitation-aware password setup/reset email flow.
- Disabled-user session and authorization enforcement.
- Required database fields and migration.
- Required authorization permissions, contracts, exports, localization, and reusable data-table labels.
- Focused behavior tests ported or adapted from the source.

## Explicit non-goals

- CV processing, AI SDK integration, or any talents-ai-specific product behavior.
- Copying unrelated source dependencies, schema objects, migrations, or configuration.
- Publishing, pushing, opening a pull request, or merging.
- Committing without explicit user authorization in this session.

## Constraints

- Follow `AGENTS.md` ownership and public-boundary rules.
- Treat the source working tree as reference material, not as a blindly copied repository snapshot.
- Preserve target-only changes and adapt source behavior to the target's current TanStack v9 data-table baseline.
- Keep server secrets and database/auth internals out of client dependency graphs.
- Use Server Actions for app-owned mutations and revalidate affected routes.
- Tests stay under top-level `tests/`.
- Technical artifacts remain in English; existing Spanish localization remains neutral/professional.

## Delivery and review forecast

- Delivery strategy: `ask-on-risk` resolved to a feature-branch commit chain.
- Chain strategy: `feature-branch-chain`.
- Planned slices: invitation-aware authentication foundation; administration server behavior; administration UI/localization; final ODD evidence update.
- Forecast: approximately 1,500–3,000 authored changed lines plus a generated Drizzle snapshot; generated files are excluded from the authored-line forecast.
- Review risk: high because the port changes authentication/session enforcement, authorization, email flows, and database schema.
- Route: delegated direct implementation. The evidence-budget and multi-file-write triggers fired (about 35–45 relevant files across multiple capabilities).
- Work-unit commits were explicitly authorized after implementation and verification.

## Tasks

- [x] **UA-001 — Add persistence and invitation-aware auth foundation**
  - Route: delegated via `gentle-ai-worker`.
  - Scope: user invitation/disabled timestamps, migration, invitation capability, invitation email delivery, password reset delivery selection, session enforcement, and auth public contracts.
  - Checks: focused auth boundary, password-reset delivery, email-template, and schema/migration checks.
  - Commit evidence: `32a77c3` (`feat: add invitation-aware authentication`); independent post-commit verification passed 3 files / 26 tests, type-check, and committed-range diff hygiene.

- [x] **UA-002 — Add user administration server behavior**
  - Route: delegated via `gentle-ai-worker`.
  - Scope: permission catalog, administration contracts/schemas/interfaces, server-only user listing, invitation actions, access actions, and public server exports.
  - Checks: focused authorization context, listing, action, and schema tests.
  - Commit evidence: `45d1131` (`feat: add user administration actions`); independent post-commit verification passed 8 files / 44 tests, type-check, and committed-range diff hygiene.

- [x] **UA-003 — Add administration UI and localization**
  - Route: delegated via `gentle-ai-worker`.
  - Scope: admin users route composition, table columns/actions, invitation dialog, reusable data-table labels needed by the source UI, client exports, and EN/ES messages.
  - Checks: focused component and route tests.
  - Commit evidence: `07f36f7` (`feat: add user administration interface`); independent post-commit verification passed 4 files / 30 tests, type-check, and committed-range diff hygiene.

- [x] **UA-004 — Reconcile source parity and integration boundaries**
  - Route: delegated via `gentle-ai-worker` if corrections touch multiple files; otherwise parent structural readback.
  - Scope: compare the resulting capability against the relevant source delta, remove accidental source-specific coupling, and close any missing public-boundary or serialization behavior.
  - Checks: import-boundary inspection and relevant regression tests.
  - Commit evidence: reconciliation covers implementation commits `32a77c3`, `45d1131`, and `07f36f7`; no corrective source commit was required.

- [x] **UA-005 — Run proportional verification and report residual risk**
  - Route: delegated via `gentle-ai-verify` as required by native assessment.
  - Scope: focused tests, typecheck, lint, migration consistency, and bounded full-suite verification when available.
  - Checks: record every pass, failure, skipped check, and environmental limitation.
  - Commit evidence: verification boundary `07f36f7`; all configured checks passed before this evidence document was committed.

## Acceptance criteria

1. An authorized administrator can list users and inspect role, verification, invitation, and access status.
2. An authorized administrator can invite a user and resend a pending invitation.
3. Invitation delivery uses a password-setup/reset link and remains distinguishable from ordinary password reset delivery.
4. An authorized administrator can disable and reactivate eligible users while self-disable and last-manager protections remain enforced.
5. Disabled users cannot create or retain valid application sessions or authorization context.
6. Database schema and migration represent invitation and disabled timestamps without importing talents-ai-specific schema.
7. The admin route remains a Server Component and composes responsibility-named feature UI through public feature boundaries.
8. English and Spanish UI/email messages cover the ported behavior.
9. Focused tests and proportional repository checks pass, or every limitation is reported explicitly.

## Progress

- Exploration complete: relevant source delta mapped; unrelated CV/AI changes excluded.
- UA-001 implementation and independent verification are complete in commit `32a77c3`: auth behavior passes 26 focused Vitest cases, `tsc --noEmit`, diff hygiene, and Drizzle v8 snapshot delta/lineage checks.
- UA-002 implementation and independent verification are complete in commit `45d1131`: 29 full focused tests plus 18 correction-focused tests pass, along with type-check and diff hygiene. Delivery-failure revalidation and explicit `UNAUTHORIZED` mapping are confirmed.
- UA-003 implementation and independent verification are complete in commit `07f36f7`: the focused UI suite passes 27 tests, type-check and diff hygiene pass, role authentication errors remain distinct, and reusable table menus are fully localized with backward-compatible defaults.
- UA-004 reconciliation is complete: all relevant source capabilities are represented, target deviations are intentional improvements/adaptations, no CV/AI coupling remains, and no correction surface was identified.
- UA-005 proportional verification is complete. The recovered verifier passed the full suite (36 files / 164 tests), type-check, lint, production build, Drizzle snapshot delta/lineage, and diff hygiene. Lint reports one non-blocking warning in unchanged `src/features/auth/email/verification-email.ts` for an unused `name` parameter; baseline attribution remains unresolved.
- Feature implementation and all ODD tasks are complete. The implementation is split into three independently verified work-unit commits on `feat/user-administration-port`.

## Verification evidence

- UA-001 focused verification: `bun run test -- tests/server/auth/auth-boundaries.test.ts tests/server/auth/password-reset-email-delivery.test.ts tests/unit/email/email-templates.test.ts` passed 3 files and 26 tests.
- UA-001 type verification: `bun run type-check` passed with no diagnostics.
- UA-001 diff hygiene: `git diff --check` passed.
- UA-001 migration structure: target-only Drizzle v8 snapshot passed delta validation (exactly `invited_at` and `disabled_at`) and lineage validation against the preceding target snapshot.
- UA-002 writer verification passed 7 files / 29 tests, type-check, and diff hygiene; correction verification passed 2 files / 18 tests and independently confirmed revalidation plus `UNAUTHORIZED`/`FORBIDDEN` separation.
- UA-003 writer verification passed 3 files / 18 tests, type-check, and diff hygiene; correction verification passed 3 files / 27 tests and independently confirmed role authentication mapping plus localized table controls with legacy defaults.
- UA-004 source parity: invitation/reset, disable/reactivate, disabled-session enforcement, listing/UI, public boundaries, schema/migration, localization, and focused coverage match the relevant source intent; no source-specific CV/AI coupling was found.
- UA-005 full suite: `bun run test:run` passed 36 files / 164 tests.
- UA-005 type-check: `bun run type-check` passed with no diagnostics.
- UA-005 lint: `bun run lint` exited 0 with one warning in unchanged `src/features/auth/email/verification-email.ts:27:3` (`name` unused); baseline attribution remains unresolved.
- UA-005 production build: `bun run build` passed.
- UA-005 migration verification: target-only snapshot delta and lineage passed.
- UA-005 diff hygiene: `git diff --check` passed.
- Browser/E2E verification was unavailable because the repository has no configured E2E script or browser tool in this workflow.
- Structural readback confirmed the users page remains a Server Component, public feature entrypoints are respected, server modules remain server-only, contracts are export-only, and no talents/CV/AI coupling appears in source, tests, migration, or dependencies.
- Source tracked delta observed: 21 modified files, 616 additions, 59 deletions.
- Source untracked delta observed: 27 files; the relevant subset includes migration, actions, data access, UI, contracts/schemas/interfaces, and focused tests.
- Target started clean on `main` at `8b671d3`; work branch created as `feat/user-administration-port`.

## Next step

Work-unit commits are complete. No push, pull request, or merge is authorized.
