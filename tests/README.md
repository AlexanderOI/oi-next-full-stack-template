# Testing Strategy

Tests live only under `tests/` and verify observable behavior at the smallest useful boundary. Every regression fix and business-rule change must ship with a test that would fail without the change. Do not test implementation details or repeat guarantees already owned by React, Next.js, Zod, Better Auth, Drizzle, or another library.

## Quick Path

```bash
# Watch while developing
bun run test

# Run the complete suite once
bun run test:run

# Run one file
bun run test:run -- tests/unit/profile/profile-schema.test.ts

# Required repository checks
bun run type-check
bun run lint
```

CI should run `bun run test:run`, `bun run type-check`, and `bun run lint`. There is no CI workflow in the repository yet, so these commands are the local merge gate.

## Test Map

Create a directory only when its first test is added.

| Location             | Purpose                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `tests/unit/`        | Pure logic, schemas, formatters, templates, and isolated service behavior                                       |
| `tests/components/`  | Client Component behavior and accessibility with Testing Library and `user-event`                               |
| `tests/server/`      | Server Component, Server Action, and route-handler orchestration                                                |
| `tests/integration/` | Real data-access constraints and adapter contracts against controlled infrastructure                            |
| `tests/e2e/`         | Critical browser-visible business flows; add with Playwright only when the first executable flow is implemented |
| `tests/fixtures/`    | Shared factories and deterministic fixture builders                                                             |
| `tests/setup.ts`     | Global matcher and environment setup; no business mocks                                                         |

Use `<subject>.test.ts` or `<subject>.test.tsx`. Mirror the source domain after the taxonomy, such as `tests/server/profile/update-profile.test.ts`. Tests must import production modules through `@/`; never reach into private implementation files solely to make testing easier.

## Testing Policy

### Must Test

- Business and security rules: validation, normalization, authorization, uniqueness, ownership, verification, and session revocation.
- Server Action outcomes: unauthenticated access, invalid input, successful mutation, expected revalidation, external failure, and partial-success reporting.
- Data rules the application depends on: unique email/username, session-to-user relationships, and destructive cascade behavior.
- External adapter contracts at the application boundary: SMTP inputs, Cloudinary validation/transformation, and error translation.
- Critical regressions and high-value business flows.
- Failure and edge cases that change what a user sees or what data is persisted.

### Should Test

- Client Component interactions through roles, labels, visible state, and user events.
- Server Component branches that enforce access or substantially change rendered content.
- Route-handler application contracts when the handler contains project-owned behavior.
- Accessible names, keyboard operation, focus/error handling, and status feedback.
- Stable email content required for security or account recovery; assert important fragments, not entire HTML snapshots.

### Do Not Test

- Hook calls, internal state, private helper invocation counts, DOM structure, generated class strings, or other implementation details.
- That a third-party component, schema library, ORM, or framework works as documented.
- Trivial pass-through modules unless they enforce a project-owned contract.
- Snapshot entire pages or large HTML documents by default. Prefer assertions that explain the required behavior.
- Coverage percentages for their own sake. Untested risk matters; a vanity number does not.

## Decision Matrix

| Unit                     | Preferred test          | What to prove                                                   | Boundary treatment                                                                                                 |
| ------------------------ | ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Pure logic and schemas   | Unit                    | Valid partitions, normalization, exact field errors, boundaries | No mocks                                                                                                           |
| Client Components        | Component               | User-visible state, interactions, submission, accessibility     | Mock Server Actions and browser-only adapters, not child internals                                                 |
| Server Components        | Server integration      | Authenticated content, redirects, server-fetched data states    | Stub auth/data boundaries; use E2E when Next.js runtime behavior is the subject                                    |
| Server Actions           | Server unit/integration | Auth first, validation, mutation, revalidation, safe errors     | Mock `headers`/`revalidatePath` and external adapters for branching; use real test DB for query semantics          |
| Data access/repositories | Integration             | Queries, constraints, transactions, and mappings                | Use an isolated database; do not mock Drizzle when SQL behavior matters                                            |
| External services        | Contract/unit           | Request mapping, validation, success mapping, provider failures | Fake only the provider SDK/network boundary                                                                        |
| Auth/security            | Server integration/E2E  | Protected access, verification, redirects, session policy       | Prefer Better Auth test configuration or public API; never assert its internals                                    |
| Route handlers           | Contract                | Status, headers, body, authentication, malformed input          | Test only project-owned behavior; Better Auth's generated handler needs a smoke test, not duplicated library tests |
| Workflows                | E2E                     | User goal and persisted result across boundaries                | Real app and isolated backing services; mock only uncontrollable third parties                                     |

Server Components are not Client Components. Do not force framework-heavy async rendering through jsdom merely to claim unit coverage. Test project-owned decisions at their extracted boundaries, then cover routing, redirects, streaming, and hydration in an executable browser flow.

## Project Examples

- `profileSchema`: prove trimming and email normalization, username character/length rules, and field-specific failures. Existing coverage starts in `tests/unit/profile/profile-schema.test.ts`.
- `passwordFormSchema`: prove minimum length, required current password, and confirmation mismatch on `confirmPassword`.
- `updateProfile`: prove unauthorized requests stop before the database; duplicate usernames return a field error; unchanged values skip writes; changed email requests verification; and an email-send failure reports whether profile details were already updated.
- `changePassword`: prove invalid data and missing sessions cannot call Better Auth, while success revokes other sessions.
- `updateAvatar` and `uploadImageCloudinary`: prove URL/MIME/size rejection, transformation mapping, missing provider results, and provider errors without making Cloudinary calls.
- `ProfileForm`, `PasswordForm`, and `AvatarForm`: prove labeled input, keyboard submission, pending/disabled state, server field errors, invalid files, preview rollback, and accessible feedback. Assert what the user can perceive, not React Hook Form state.
- `ProfilePage` and the authenticated app layout: prove unauthenticated redirects and authenticated user content. Avoid re-testing Next.js `redirect` itself.
- `email-templates`: prove security-sensitive escaping, destination links, and the distinction between account and email-change verification.
- `sendEmail`: prove the application maps sender, recipient, subject, and HTML to the transport and safely exposes provider failures; do not test Nodemailer transport internals.
- `src/db/schema.ts`: integration-test unique identities, required fields, and session/account cascade deletion against an isolated PostgreSQL-compatible database.
- Better Auth route handling: smoke-test that the mounted endpoint is reachable and configured; leave protocol permutations to Better Auth.

## Mocks And Test Data

- Mock at process boundaries: Better Auth API, SMTP transport, Cloudinary SDK, Next.js request/cache primitives, and the network.
- Keep pure schemas, templates, and the function under test real.
- Prefer dependency injection or an adapter seam over deep module mocking when a service grows.
- Reset mocks after every test. Never share mutable users, sessions, files, or database rows.
- Build fixtures with small typed factories and explicit overrides, for example `buildUser({ emailVerified: false })`. Defaults must be valid and deterministic.
- Use fixed IDs and timestamps. Never depend on the developer's environment, clock, network, or production credentials.
- A data integration suite must own an isolated database lifecycle and clean up even after failure.

## Failure, Security, And Accessibility

For each meaningful path, consider empty, malformed, minimum/maximum, duplicate, stale-session, unauthorized, provider-timeout, and partial-failure cases. Assert safe user-facing errors and confirm forbidden side effects did not happen.

Query components by role, accessible name, label, or visible text. Cover keyboard use, disabled and pending controls, validation association, focus after errors where relevant, image alternatives, and status/error announcements. A CSS selector is not a user contract.

## Coverage Philosophy

Coverage is a navigation aid, not a target. Review missing branches in authorization, validation, persistence, and recovery paths first. Exclude generated or declarative framework code only when it contains no project decision. Add coverage tooling when the suite is large enough for its report to guide risk; do not block work on an arbitrary percentage.

## Definition Of Done

- [ ] The test describes behavior and fails when that behavior is removed.
- [ ] Happy path, relevant failure path, and boundary values are covered.
- [ ] Authorization and forbidden side effects are checked for mutations.
- [ ] Mocks stop at external boundaries and are reset.
- [ ] UI assertions use accessible, user-visible queries.
- [ ] Fixtures are deterministic and isolated.
- [ ] `bun run test:run`, `bun run type-check`, and `bun run lint` pass.
- [ ] The test and strategy remain under `tests/`; no colocated test is introduced.

## Adoption Priorities

1. Protect profile and account security: password schema, all profile Server Actions, verified email change, auth redirects, and partial failures.
2. Protect provider boundaries: Cloudinary file validation/upload mapping and SMTP delivery inputs/errors.
3. Add database integration coverage for unique username/email and auth cascade rules.
4. Add behavior and accessibility tests for the three profile forms.
5. Introduce Playwright with isolated test data for sign-up verification, sign-in, profile update, password change, and avatar update. Do not add it before one flow can run reliably in local and CI environments.
