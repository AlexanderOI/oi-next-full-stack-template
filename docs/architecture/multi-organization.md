# Multi-organization architecture: one global identity, organization-scoped access

## Executive decision

The application will use **one globally unique identity per person** and **one canonical Better Auth organization membership per identity–organization pair**. Every tenant-bound read, mutation, role assignment, invitation administration event, and audit event is scoped to an organization. A session stores `activeOrganizationId`, while application routes use `/org/[organizationSlug]`; protected content is rendered only when both resolve to the same active membership.

Better Auth's Organization plugin supplies the canonical organization, member, invitation, and active-organization schema. Product code owns the policies that Better Auth does not provide: immutable organization restriction, managing-organization allowlists, provisioning modes, tenant-aware authorization, continuity guarantees, and deletion consequences. Better Auth 1.6.25's stock invitation-acceptance and organization-deletion mutations are disabled because their write ordering violates this design; product-owned server transactions write the same canonical tables instead of creating parallel stores.

This is a target-state design, not a compatibility plan. **The database may be reset when implementation begins. No data backfill, legacy migration compatibility, or dual-read/dual-write period is required.** Schema generation is still required for the new target schema, but preserving current rows is not.

### Scope

- Global identity and account status.
- Organizations, memberships, invitations, active context, provisioning, suspension, removal, and deletion.
- Global permission definitions, protected roles, organization-owned custom roles, membership-scoped assignments, and organization-bound authorization audit.
- Restricted identities, managing organizations, and explicit allowlist grants.
- Better Auth Organization integration boundaries.
- Repository ownership, implementation order, test strategy, reset/bootstrap, operations, and serializable action results.

### Non-goals

- Implementing code, tests, schema, migrations, dependencies, or configuration in this document change.
- Preserving current database contents or current invitation records.
- Ambiguous global role assignments: organization assignments are always membership-scoped, and platform assignments use the dedicated `platform_role_assignment` table.
- Team support inside an organization. Better Auth Organization teams remain disabled until a separate product decision.
- Cross-organization aggregate administration through ordinary organization permissions.
- Automatically resolving a session/URL organization mismatch.
- Removing an identity's organization restriction. Restriction is permanent.
- Revoking an allowlist exception grant. Grants are permanently non-revocable.

## Quick implementation path

1. Reset the database and install the target Better Auth Organization schema as the sole organization/member/invitation store.
2. Bootstrap global permission and protected-role definitions.
3. Implement organization context resolution and deny access unless session, URL, identity, and membership state agree.
4. Move authorization, invitations, provisioning, role assignments, and member administration behind organization-scoped server APIs.
5. Add deletion/orphan handling, audit, observability, and the complete scenario matrix before exposing the feature.

## Current-state repository evidence

The current repository is single-tenant. These paths are evidence to replace or scope; they are not target behavior.

| Current boundary              | Concrete evidence                                                                                                                       | Current assumption that must change                                                                                                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and session schema   | `src/db/schema.ts`                                                                                                                      | `user.email` and `user.username` are global unique values, which remains correct. `user.invitedAt` models an invitation as a pending identity, `user.disabledAt` is only global, and `session` has no active organization.                    |
| Global authorization schema   | `src/db/schema.ts`                                                                                                                      | Role definitions carry explicit platform/organization scope. Platform access uses `platform_role_assignment`; organization access uses membership-scoped `membership_role`. The obsolete `user_role` table has been removed without backfill. |
| Better Auth configuration     | `src/features/auth/server.ts`                                                                                                           | Only `username()` and `nextCookies()` are installed. A user-create hook assigns the global `member` role, and session creation checks only global `user.disabledAt`.                                                                          |
| Browser auth boundary         | `src/features/auth/lib/auth-client.ts`, `src/features/auth/components/sign-up-form.tsx`                                                 | Signup calls Better Auth directly and completes without creating a personal organization. The client has no Organization plugin.                                                                                                              |
| Signup validation             | `src/features/auth/schemas/register-schema.ts`                                                                                          | Username normalization/format is global identity behavior. It must not be reused as organization-slug normalization without separate slug rules.                                                                                              |
| Authorization context         | `src/features/authorization/server.ts`, `src/features/authorization/utils/build-authorization-snapshot.ts`                              | Permission rows are loaded by `userId` alone. The snapshot contains `userId`, roles, and permissions but no organization or membership.                                                                                                       |
| Global policy continuity      | `src/features/authorization/lib/authorization-policy.ts`                                                                                | Administrative continuity counts global admins, not owners/admins in one organization.                                                                                                                                                        |
| User administration           | `src/features/authorization/actions/manage-user-access.ts`, `src/features/authorization/actions/manage-user-roles.ts`                   | Platform access and role replacement are global operations backed by `platform_role_assignment`; each selected role is checked for platform scope. Global suspension deletes all sessions.                                                    |
| Role administration           | `src/features/authorization/actions/manage-roles.ts`                                                                                    | Custom and protected roles share one global namespace; custom roles have no owner organization.                                                                                                                                               |
| Invitation implementation     | `src/features/authorization/actions/manage-user-invitations.ts`, `src/features/auth/lib/invitation-capability.ts`                       | Inviting creates a global identity with a random password and uses password reset as invitation acceptance. It is not an organization invitation lifecycle.                                                                                   |
| Global user listing           | `src/features/authorization/data/list-users-with-roles.ts`                                                                              | Every user is listed, including roles from every assignment; there is no organization filter.                                                                                                                                                 |
| Route protection              | `src/app/(app)/layout.tsx`, `src/app/(app)/admin/layout.tsx`                                                                            | The shell requires only a valid session and a global authorization snapshot. Admin routes are `/admin/...`, not organization routes.                                                                                                          |
| Administration pages          | `src/app/(app)/admin/users/page.tsx`, `src/app/(app)/admin/roles/page.tsx`                                                              | Pages fetch all users/roles and evaluate global permissions.                                                                                                                                                                                  |
| Application shell             | `src/features/app-shell/components/app-header.tsx`, `src/features/app-shell/components/app-sidebar.tsx`                                 | There is no organization switcher, and links omit an organization slug.                                                                                                                                                                       |
| Bootstrap and emergency grant | `scripts/bootstrap-authorization.ts`, `scripts/grant-admin.ts`                                                                          | Bootstrap idempotently assigns the platform member role where no platform assignment exists; the emergency grant script writes an explicit platform admin assignment. Neither writes organization roles.                                      |
| Messages                      | `messages/en.json`, `messages/es.json`                                                                                                  | Existing auth and authorization copy assumes global users, roles, and invitations.                                                                                                                                                            |
| Tests                         | `tests/server/auth`, `tests/server/authorization`, `tests/unit/authorization`, `tests/components/authorization`, `tests/server/routing` | Current tests encode global snapshots, user lists, role assignment, invitation-as-password-reset, and non-organization routes. They must be replaced or extended with tenant behavior.                                                        |

## Terminology and confirmed product decisions

### Terms

| Term                       | Meaning                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity                   | The global `user` record and its authentication accounts. Email and username identify it globally.                                                                            |
| Organization               | A tenant and authorization boundary with a unique normalized slug. A personal organization is still a full organization.                                                      |
| Membership / member        | The canonical relationship between one identity and one organization. “Member” is the Better Auth model name; this document uses membership when discussing the relationship. |
| Active membership          | A membership that exists and is not suspended. It is separate from global identity state.                                                                                     |
| Personal organization      | The organization created during public self-registration, owned by that identity.                                                                                             |
| Managing organization      | The organization that provisioned a restricted identity and controls possible allowlist exceptions. It is fixed until that organization is deleted.                           |
| Restricted identity        | An identity with immutable `isOrganizationRestricted = true`. It may belong only to its managing organization and explicitly allowlisted organizations.                       |
| Allowlist grant            | A managing-organization authorization for one restricted identity to join one additional organization. It is not membership and grants no permissions by itself.              |
| Protected role             | A globally defined, non-editable role such as owner, admin, or member. Its assignment is still through an organization membership.                                            |
| Custom role                | A role definition owned by exactly one organization. It is usable only by memberships in that organization.                                                                   |
| Platform authorization     | Privileges over global identity/platform operations. It is never inferred from an organization role.                                                                          |
| Organization authorization | Permissions derived from one active membership and its role assignments in one organization.                                                                                  |
| Active organization        | The organization ID stored on one session and represented by the current `/org/[organizationSlug]` route.                                                                     |

### Confirmed product decisions

This list is intentionally limited to decisions recorded as confirmed in the ODD task.

- One global identity may belong to multiple organizations.
- Email and username remain globally unique.
- Public self-registration creates a username-derived personal organization and makes the user its owner.
- Administrator-provisioned users start only in the administrator's active organization and receive no personal organization.
- An administrator with the protected permission may mark a newly provisioned user as organization-restricted.
- Base restriction is immutable; additional organizations require explicit allowlist grants.
- Allowlist exception grants are permanently non-revocable; there is no revoke operation.
- A restricted user cannot receive or accept an invitation outside the effective allowlist.
- The invitation creator selects the membership role applied on acceptance; role policy is validated both when the invitation is created and when it is accepted. Inviting the protected `owner` role additionally requires `organization.ownership.transfer`; admins cannot invite owners.
- Invitations may target an unknown email address; the recipient signs up with the same normalized email, completes public verification, and then accepts the invitation. Public signup still creates the recipient's personal organization and owner membership; acceptance does not switch the active organization.
- The canonical invitation `role` field stores the selected product role ID. Product acceptance resolves that ID and writes the membership-scoped `membershipRole`; `member.role` stays at the safe Better Auth lifecycle role `member` because product permissions do not use the provider's role field.
- Explicit re-inviting/resending a pending invitation replaces the old token with a new canonical invitation expiring exactly two days later; the old token is invalidated. A partial unique index permits at most one pending invitation per organization and normalized email; concurrent uniqueness conflicts return the existing invitation state rather than create duplicates.
- Invitations expire exactly two days after creation, and there is no pending-invitation count cap.
- An identity may belong to at most 100 organizations, and an organization may have at most 1,000 active members.
- Protected role definitions are global; custom roles are organization-owned.
- Suspending an identity with one active membership suspends it globally; with multiple active memberships, only the selected membership is suspended.
- Removing or voluntarily leaving the final membership outside organization deletion atomically deletes the identity and all sessions.
- Deleting an organization deletes identities whose only membership is in that organization.
- If a restricted identity has other allowlisted memberships when its managing organization is deleted, it survives only in those organizations, loses the live managing-organization reference, and cannot expand its frozen allowlist.
- Active organization is stored in the session and represented in the URL; both must agree.
- Existing data need not be migrated because implementation may reset the template database.

### Architecture requirements and defaults

These rules make the confirmed decisions implementable but are not additional confirmed product decisions:

- **Requirement:** organization slugs use separate normalization, validation, reserved-word, and collision rules.
- **Requirement:** invitation acceptance never changes `activeOrganizationId`; organization selection is a separate explicit mutation.
- **Default:** an invitation recipient without an identity follows ordinary public self-signup, including personal-organization creation, before accepting. This is inferred from the current distinction between public signup and administrator provisioning and remains changeable by a product decision.
- **Default:** invitation resend replaces/cancels the old pending capability and issues a new one rather than extending it.

## Target domain model

### Relationship summary

```text
Identity 1 ── * Session
Identity 1 ── * Membership * ── 1 Organization
Membership 1 ── * MembershipRole * ── 1 Role
Role 1 ── * RolePermission * ── 1 Permission
Organization 1 ── * Invitation
Live Managing Organization 0..1 ── * AllowlistGrant * ── 1 Allowed Organization
Identity 1 ── * AllowlistGrant
Organization 1 ── * AuthorizationAudit
```

An invitation is not a membership. An allowlist grant is not a membership or permission assignment. A session's active organization is context, not authorization; an active membership must still be resolved on every request.

### Entities and storage rules

| Entity                     | Key fields and state                                                                                                                                                                                                                                                                                                     | Cardinality and uniqueness                                                                                                                                                                                   | Constraints, indexes, and deletion behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identity (`user`)**      | Existing auth fields; `username`; normalized `email`; `disabledAt`; `isOrganizationRestricted`; nullable `managingOrganizationId`; immutable nullable `managingOrganizationIdSnapshot`, `managingOrganizationSlugSnapshot`, and `managingOrganizationNameSnapshot`; nullable `allowlistFrozenAt`; timestamps             | Email unique globally; username unique globally. One live managing organization at most.                                                                                                                     | Check: unrestricted implies all manager references/snapshots and `allowlistFrozenAt` are null. Restricted cannot become unrestricted. Set the immutable manager snapshots with the live reference during restricted provisioning. The live manager FK is nullable with `ON DELETE SET NULL`; snapshots survive manager deletion. `allowlistFrozenAt` is set in the deletion transaction before that FK is cleared. Index `managingOrganizationId` and `disabledAt`. Identity delete cascades accounts, sessions, memberships, and grants; invitations addressed only through email remain independently lifecycle-managed.                                                                                                                           |
| **Organization**           | `id`, display `name`, normalized `slug`, `kind` (`personal` or `standard`), `createdByUserId`, optional logo/metadata, timestamps                                                                                                                                                                                        | Slug unique globally after organization-specific normalization. An identity can create at most one personal organization; enforce a unique personal owner/creator relation or an equivalent idempotency key. | Reject reserved slugs before persistence; DB unique index remains the race-safe authority. Index `createdByUserId`. Deletion is permitted only through the product deletion transaction, never an unwrapped adapter call.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Membership (`member`)**  | Better Auth fields `id`, `organizationId`, `userId`, lifecycle `role`; product fields `status` (`active`/`suspended`), `suspendedAt`, `suspendedByUserId`, timestamps                                                                                                                                                    | Organization has many memberships; identity has many memberships; unique `(organizationId, userId)`.                                                                                                         | Index `(userId, status)`, `(organizationId, status)`, and organization lifecycle role. Organization or identity deletion cascades membership. Membership deletion cascades membership-role assignments. `status` is the product gate; the Better Auth row remains the only membership row.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Invitation**             | Better Auth fields `id`, `organizationId`, normalized `email`, inviter identity/member reference, creator-selected initial membership role, `status`, `expiresAt`, timestamps; optional replacement invitation ID                                                                                                        | Many invitations per organization. At most one effective pending invitation per `(organizationId, normalizedEmail)`; re-send replaces/cancels the old capability.                                            | Index `(organizationId, status, expiresAt)` and `(normalizedEmail, status)`. Expired, accepted, rejected, and canceled are terminal. Organization deletion cascades/cancels. Inviter deletion uses `SET NULL` where the plugin permits while preserving an inviter snapshot for audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Permission**             | Stable global `key`, display name, description, category, authorization `scope` (`platform` or `organization`), `isProtected`, timestamps                                                                                                                                                                                | Key unique globally.                                                                                                                                                                                         | Definitions are bootstrapped from the code catalog. Deleting a permission cascades role-permission links only during controlled bootstrap/schema reset, not ordinary UI behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Role**                   | `id`, `key`, name, description, explicit `scope` (`platform` or `organization`), nullable `organizationId`, `isProtected`, timestamps                                                                                                                                                                                    | Protected role definitions are global and unique by `(scope, key)`; custom roles are organization-owned and unique by `(organizationId, key)`.                                                               | Scope check limits values to platform/organization. Protected roles have null organization ownership; organization custom roles require an owner organization. During the transition, the existing global role editor may also write unprotected platform roles with null ownership, uniquely keyed within platform scope. Partial unique indexes enforce each scoped key under races. Organization deletion cascades custom roles only. Role deletion is denied while assigned.                                                                                                                                                                                                                                                                     |
| **RolePermission**         | `roleId`, global `permissionKey`                                                                                                                                                                                                                                                                                         | Unique `(roleId, permissionKey)`.                                                                                                                                                                            | Role deletion cascades links. Permission assignment to a custom role is valid only for organization-scoped, non-protected permissions; platform permissions and protected organization permissions cannot be added to custom organization roles.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **MembershipRole**         | `membershipId`, `roleId`, `assignedByMembershipId`, timestamp                                                                                                                                                                                                                                                            | Unique `(membershipId, roleId)`. Every organization assignment belongs to one membership, never directly to an identity.                                                                                     | A role is assignable when it is protected/global or owned by the membership's organization. The assignment service validates this in the same transaction. Index `roleId`; membership deletion cascades assignments and deleting the assigning membership nulls its actor reference. Role deletion is denied while any assignment exists.                                                                                                                                                                                                                                                                                                                                                                                                            |
| **PlatformRoleAssignment** | `userId`, `roleId`, `assignedByUserId`, timestamp                                                                                                                                                                                                                                                                        | Unique `(userId, roleId)`. Platform authority is explicitly assigned to an identity in a separate table.                                                                                                     | This table is the target platform authorization assignment source and carries actor provenance. It is never used for organization roles; organization roles are assigned only through `MembershipRole`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **AllowlistGrant**         | `id`, `subjectUserId`; nullable live `grantingOrganizationId`; immutable `grantingOrganizationIdSnapshot`, `grantingOrganizationSlugSnapshot`, and `grantingOrganizationNameSnapshot`; `allowedOrganizationId`; nullable `grantedByMembershipId`; immutable `grantedByUserIdSnapshot`; `createdAt`; no revocation fields | Unique grant per `(subjectUserId, allowedOrganizationId)`. Granting and allowed organizations must differ at creation.                                                                                       | Subject must be restricted and managed by the live granting organization when created. The actor must be another active member there with the protected grant permission. `subjectUserId` cascades on identity deletion. `grantingOrganizationId` is nullable with `ON DELETE SET NULL`; its snapshots are immutable and preserve provenance. `grantedByMembershipId` uses `ON DELETE SET NULL`; actor identity snapshot remains. `allowedOrganizationId` is non-null with `ON DELETE CASCADE`, because a deleted target cannot remain eligible. Index subject and both live organization references. Manager deletion therefore preserves grants to surviving targets without a contradictory cascade. Product APIs never update or revoke a grant. |
| **AuthorizationAudit**     | `id`, `organizationId` nullable FK, immutable `organizationIdSnapshot`, actor identity ID and nullable actor membership ID, action, target type/ID, outcome, reason code, request/correlation ID, metadata, timestamp                                                                                                    | Many events per organization; no update/delete through product APIs.                                                                                                                                         | Index `(organizationId, createdAt)`, actor, target, action, and correlation ID. Organization FK uses `SET NULL` so deletion evidence survives; snapshot retains the deleted tenant ID/slug. Sensitive values and invitation tokens are prohibited in metadata.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Session**                | Existing Better Auth session fields plus nullable `activeOrganizationId`                                                                                                                                                                                                                                                 | Many sessions per identity. Active organization is per session, not per identity.                                                                                                                            | Index `(userId, activeOrganizationId)`. Product deletion leaves surviving sessions unchanged until the organization transaction commits, then clears affected active contexts; it never auto-selects another organization. Identity suspension/deletion removes all sessions. A non-null value is usable only if the identity and matching membership are active.                                                                                                                                                                                                                                                                                                                                                                                    |

### Membership role representation and Better Auth

`MembershipRole` is the product authorization source of truth. Better Auth's required `member.role` field remains a narrowly scoped lifecycle projection for Organization-plugin checks (`owner`, `admin`, or `member`), not a second product permission store. All membership-role writes go through one organization-owned service that updates assignments and the lifecycle projection atomically. Product authorization never trusts the projection alone. A mismatch fails closed, emits an operational event, and must be repaired before lifecycle mutation continues.

This separation permits global protected role definitions and organization-owned custom roles without creating a second membership table. It also prevents custom product permissions from being confused with Better Auth's plugin-management permissions.

### Active role-assignment stores

Platform authorization assignments are stored only in `platform_role_assignment` and reference roles with `scope = 'platform'`. Platform access checks, role listings, user administration, auth bootstrap, and emergency grants use this source and never infer platform authority from an organization assignment. `assignedByUserId` records an application actor when one exists; auth/bootstrap and emergency CLI grants use a null actor.

Organization authorization assignments are stored only in `membership_role`, keyed by canonical Better Auth membership. Assignment validation requires a role usable by that membership's organization; organization custom roles use `scope = 'organization'` and a non-null owning organization. Platform assignments never receive organization roles, and membership assignments never confer platform permissions.

MO-IMPL-004 removes the obsolete `user_role` schema/export and generates a sequential drop migration. There is no assignment-data backfill or dual-read/write period because the database is resettable. Historical migration SQL and snapshots remain immutable; the generated migration drops the legacy table for the current migration lineage.

## Security invariants

Stable IDs are mandatory in tests, audit reason codes, and review notes.

| ID             | Invariant                                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MO-SEC-001** | Normalized email is globally unique across identities.                                                                                                                                                                                                                                                 |
| **MO-SEC-002** | Normalized username is globally unique across identities.                                                                                                                                                                                                                                              |
| **MO-SEC-003** | Organization slug is normalized independently from username, excludes reserved names, and is globally unique at the database boundary.                                                                                                                                                                 |
| **MO-SEC-004** | `isOrganizationRestricted` may change only from false to true during restricted admin provisioning; it can never return to false.                                                                                                                                                                      |
| **MO-SEC-005** | A restricted identity may hold an active membership only in its managing organization or an organization covered by its effective allowlist.                                                                                                                                                           |
| **MO-SEC-006** | Invitation creation for an existing restricted identity checks the effective allowlist before storing or sending the invitation.                                                                                                                                                                       |
| **MO-SEC-007** | Invitation acceptance rechecks recipient email, expiry, identity state, membership state and limits, managing organization, allowlist, and role policy in the same transaction that conditionally accepts the invitation and creates the canonical membership; creation-time approval is insufficient. |
| **MO-SEC-008** | A restricted subject cannot grant an allowlist exception to itself, even if it has administrative permissions in the managing organization.                                                                                                                                                            |
| **MO-SEC-009** | The recipient/allowed organization cannot authorize itself. Only another authorized active membership in the subject's managing organization may create the grant.                                                                                                                                     |
| **MO-SEC-010** | When a managing organization is deleted and the restricted identity survives, its live manager reference becomes null, immutable manager/grant snapshots remain, `allowlistFrozenAt` is set, and grants to surviving allowed organizations remain effective but can never expand.                      |
| **MO-SEC-011** | Every tenant-bound read and mutation includes an explicit organization predicate derived from validated context. Looking up a tenant-owned object by ID alone is forbidden. The listed global/invitation/context exceptions validate their own narrower contracts.                                     |
| **MO-SEC-012** | Session `activeOrganizationId`, URL slug, resolved organization, active identity, and active membership must all agree before tenant-bound protected rendering or mutation. Context-establishing and invitation-recipient exceptions do not pretend to have an already validated tenant context.       |
| **MO-SEC-013** | No role assignment targets an identity directly. Every assignment targets a membership and is valid only for that membership's organization.                                                                                                                                                           |
| **MO-SEC-014** | Protected role definitions are global and immutable; their assignments are organization-scoped and mutable only within continuity rules.                                                                                                                                                               |
| **MO-SEC-015** | Each live organization always has at least one active owner. Removing, leaving, suspending, or demoting the last active owner is denied.                                                                                                                                                               |
| **MO-SEC-016** | Each live organization retains an active principal for required administration capabilities. A change that removes the final effective administrator for a required capability is denied. Owners carry the complete organization-management capability set.                                            |
| **MO-SEC-017** | Global identity suspension invalidates all sessions. Membership suspension invalidates that organization's active context in all affected sessions but does not revoke other memberships.                                                                                                              |
| **MO-SEC-018** | Platform permissions and organization permissions are evaluated separately. Organization roles cannot confer platform authority.                                                                                                                                                                       |
| **MO-SEC-019** | Invitation tokens are opaque, single-use, recipient-email-bound, expiring capabilities. Terminal or replaced invitations cannot be replayed.                                                                                                                                                           |
| **MO-SEC-020** | Organization-bound audit events record the organization, actor identity, and actor membership when a membership authorized the action; invitation-recipient flows record null actor membership. Denied high-risk mutations are included.                                                               |
| **MO-SEC-021** | Lifecycle decisions are revalidated inside the write transaction at serializable isolation or with equivalent row locking; preflight UI state never authorizes a write.                                                                                                                                |
| **MO-SEC-022** | Stock Better Auth acceptance and deletion endpoints, direct `auth.api` calls, alternate routes, scripts, and background jobs may not bypass the product-owned transactional adapters or restriction, allowlist, tenant, continuity, session-ordering, and audit policy.                                |

## Identity and provisioning modes

| Mode                               | Personal organization                                                                             | Initial membership                                     | Restriction state                                                         | Future invitations                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Public self-service owner**      | Created from a separately normalized username-derived slug, with deterministic collision handling | Owner of the new personal organization                 | Unrestricted; no managing organization                                    | May accept any valid invitation                                                                    |
| **Admin-provisioned unrestricted** | None                                                                                              | Member of the administrator's active organization only | Unrestricted; no managing organization                                    | May later accept invitations to other organizations                                                |
| **Admin-provisioned restricted**   | None                                                                                              | Member of the administrator's active organization only | Restricted permanently; active organization becomes managing organization | May accept only invitations to the managing organization or an explicitly allowlisted organization |

A normal invitation does not become admin provisioning. As an **architecture default, not a confirmed product decision**, an invited email with no identity follows self-service registration, gets a personal organization, and then accepts the invitation. Under this default, only explicit administrator provisioning suppresses personal-organization creation.

## State rules

### Identity and membership states

| Identity state | Membership state | Access result                                                        |
| -------------- | ---------------- | -------------------------------------------------------------------- |
| Active         | Active           | Eligible if session/URL context matches and permissions allow.       |
| Active         | Suspended        | Denied in that organization; other active memberships remain usable. |
| Suspended      | Any              | Denied globally; all sessions are invalidated.                       |
| Deleted        | Any              | No access; dependent auth data and memberships are deleted.          |

### Invitation transitions

```text
pending ──accept──> accepted
pending ──reject──> rejected
pending ──cancel──> canceled
pending ──expiry──> expired (derived or persisted terminal state)
pending ──resend──> canceled/replaced + new pending invitation
```

Only `pending` and unexpired invitations can transition. Repeating a terminal transition returns the existing terminal result when safe; it never creates another membership or sends another email implicitly.

### Restricted eligibility

For restricted identity `U` and target organization `T`:

- If `U.managingOrganizationId` is non-null, `T` is eligible when it is the managing organization or a grant exists whose live `grantingOrganizationId` equals that manager and whose live `allowedOrganizationId` equals `T`.
- If `U.managingOrganizationId` is null, `T` is eligible only when `allowlistFrozenAt` is non-null and a preserved grant has a null live granting reference, matching immutable manager snapshot, and live `allowedOrganizationId = T`. No row can be added or rewritten after freezing.
- Eligibility permits invitation/membership; it does not grant the membership, role, or permission.

## Detailed lifecycle flows

Tenant-bound reads and mutations authenticate first, resolve the active organization from both session and URL, authorize against the active membership, validate input, and recheck policy inside the transaction. Email delivery and cache revalidation happen after commit unless explicitly noted.

The tenant-context precondition does **not** apply before context exists or when the operation's subject is an invitation rather than an active tenant. The exact exceptions are:

- public signup;
- sign-in and password recovery;
- listing the authenticated user's pending invitations;
- invitation acceptance or rejection;
- explicit organization selection or switch.

Each exception still validates its own contract. Signup validates global email/username and onboarding state; sign-in/recovery validates identity and credential/recovery ownership; pending-invitation listing is filtered to the authenticated normalized email; acceptance/rejection validates session identity, recipient email, invitation state and expiry; and selection/switch validates an active target membership before changing context. The exception never authorizes tenant data unrelated to that contract.

### Public self-signup

1. Normalize and validate email and username globally.
2. Derive an organization-slug candidate with the separate slug normalizer. Reject reserved names; resolve ordinary collisions deterministically by prompting for/allocating another available slug rather than weakening uniqueness.
3. Create the Better Auth identity as unrestricted.
4. In one application transaction, create a deterministic personal organization in Better Auth's canonical tables, mark it with the private nullable `personalSignupOwnerUserId` provenance field, create its active `owner` membership and membership-scoped `system:organization:owner` assignment, and set the private `user.initialActiveOrganizationId` marker. Resolve slug collisions with a stable numeric suffix; retry validates that the provenance marker exactly matches the identity and that the organization, active membership, and owner assignment still agree.
5. After that transaction commits, send verification through Better Auth's public verification endpoint. Automatic signup delivery is disabled. Until verified, the identity cannot create a session.
6. On the first verified session creation, set `session.activeOrganizationId` only when the private marker and matching active membership still exist. After `getCurrentSession` observes that matching session persisted in the database, clear the marker. Later sessions do not auto-select an organization.
7. Redirect to `/org/[personalSlug]` only after session and URL can agree.

**Failure and transaction behavior:** The organization and its signup provenance, active owner membership, membership-role assignment, and initial-org marker are one transaction. If provisioning fails, send no verification; compensation deletes the organization only when both its deterministic ID and provenance owner match this identity, then deletes the identity (which cascades its accounts and sessions). Unmarked or differently owned organizations are left untouched. A delivery failure may leave only an unverified identity whose organization and owner membership are ready; the public verification endpoint remains available for a safe resend. A uniqueness race returns a specific email, username, or slug conflict.

### Administrator provisioning: unchecked (unrestricted)

1. Resolve the administrator's active organization and require its provisioning permission.
2. Validate that email and username do not already identify a user. Existing identities use the invitation flow instead.
3. Create an unverified/pending unrestricted identity with no personal organization.
4. Add its canonical membership to the active organization with the default protected member role.
5. Send an activation/set-password message after persistence.

The identity may later accept invitations from any organization. Delivery failure leaves a safe pending identity and membership and returns a resend-capable result; it does not create another identity on retry. Until activation completes, the pending identity cannot sign in.

### Administrator provisioning: checked (restricted)

The unchecked flow applies with these additions in the same provisioning unit:

- Set `isOrganizationRestricted = true`, `managingOrganizationId = activeOrganizationId`, and immutable managing-organization ID/slug/name snapshots at creation.
- Do not create an allowlist row for the managing organization; it is eligible by definition.
- Record the restriction decision and managing organization in audit.
- The checkbox/flag is accepted only on initial provisioning by an actor with the protected restriction permission. No later action can clear it or change the managing organization.

Failure rolls back or compensates identity, membership, and restriction as one unit. A partially restricted account without its managing membership is not usable.

### Invite an existing identity

1. Resolve the recipient by normalized email without exposing account existence to unauthorized callers.
2. Reject an existing membership idempotently as `ALREADY_MEMBER`.
3. If restricted, enforce MO-SEC-006. Neither the inviter's target organization nor the recipient can manufacture the required grant.
4. Validate the creator-selected initial membership role ID: the inviter must have the corresponding role-assignment authority; assigning protected `owner` additionally requires `organization.ownership.transfer`, and custom roles must belong to the target organization.
5. Create one pending Better Auth invitation with `expiresAt` exactly two days after creation and send its opaque link after commit. Do not enforce a pending-invitation count cap.

A concurrent unique pending-invitation conflict returns the existing invitation state. An explicit re-invite/resend follows the confirmed replacement flow below; it is not accidental duplicate creation.

### Invitation signup for a new identity

This is the confirmed flow: an invitation may target an unknown email; the recipient signs up with that same normalized email, verifies it, and then accepts.

1. Opening the invitation stores only the opaque invitation reference in the flow; it does not create membership.
2. If no identity exists for the invitation email, require public self-registration with that same normalized email.
3. Complete the ordinary self-service flow, including personal organization and owner membership.
4. After email ownership is verified as required, resume the invitation and run the product acceptance transaction.
5. The session remains active in the personal organization unless the recipient later invokes the explicit switch action. Acceptance itself never changes context; this no-switch rule is an architecture requirement.

If signup succeeds but acceptance fails because the invitation expired, was canceled, reached capacity, or became ineligible, the personal identity/organization remain valid and the failure is shown. If another identity email is used, return `INVITATION_RECIPIENT_MISMATCH` without revealing additional details.

### Accept invitation through the product adapter

The stock Better Auth 1.6.25 acceptance endpoint is not used. The product Server Action calls a server-only acceptance adapter that owns one database transaction over the canonical Better Auth `invitation` and `member` tables plus product role/audit tables:

1. Authenticate the session without requiring an already active target-organization context.
2. In the transaction, lock/read the invitation and target organization and conditionally require `status = pending`.
3. Validate normalized recipient email against the authenticated session identity, required email verification/ownership, `expiresAt > now`, active identity state, no existing canonical membership, membership limit, restriction/frozen-allowlist eligibility, and current role policy.
4. Resolve the invitation's role ID to a currently valid protected role or a custom role owned by the target organization. Insert exactly one canonical Better Auth member row with lifecycle role `member`, create the matching `membershipRole` assignment, and conditionally update that same canonical invitation from `pending` to `accepted`.
5. Insert the target-organization acceptance audit in the transaction. Any failure rolls back invitation, membership, assignments, and audit together.
6. Do not write the session table or set `activeOrganizationId`. After commit, revalidate the recipient's pending-invitation view and target organization paths, then return a serializable result that lets the UI offer a separate explicit switch.

A unique `(organizationId, userId)` constraint and the conditional invitation transition serialize concurrent acceptance. A retry returns `changed: false` only when the invitation is already accepted and the matching canonical membership/role projection is consistent; accepted-without-member or member-with-pending-invitation is an invariant failure, not success. Product code must not call `auth.api.acceptInvitation` or import Better Auth's internal endpoint/adapter implementation.

### Reject, cancel, resend, and expiry

- **Reject:** only the authenticated recipient with matching email may reject a pending, unexpired invitation. Mark terminal and audit the target organization.
- **Cancel:** only an authorized active membership in the inviting organization may cancel. Target by `(invitationId, organizationId)`, not ID alone.
- **Re-invite/resend (confirmed):** authorize and recheck current eligibility/capacity. Cancel/replace the old pending capability and create a new opaque invitation with a fresh two-day expiry. Configure Better Auth consistently with replacement semantics (`cancelPendingInvitationsOnReInvite`) so old links cannot be used.
- **Expiry:** acceptance treats `expiresAt <= now` as expired even if no cleanup job has persisted the status. A periodic cleanup may mark expired rows for reporting. Resend creates a new invitation; it never extends/revives the old token.
- **Delivery failure:** the pending row remains with a recoverable delivery-failed result and may be resent. Never roll back a committed invitation solely because an external email provider failed.

### Allowlist grant

1. Require the subject to be an existing restricted identity with a non-null managing organization.
2. Require the actor to be a different identity with an active membership and grant-management permission in that managing organization.
3. Require the allowed organization to exist, differ from the managing organization, and not already be granted.
4. Create the grant with the live granting/allowed organization references, immutable granting organization ID/slug/name and actor-user snapshots, and audit both organization IDs, with the managing organization as the authorization boundary.

Creating a grant does not create an invitation or membership. This two-step separation makes recipient-organization self-authorization impossible.

### Permanent allowlist grants

Allowlist exception grants are permanently non-revocable. Product APIs expose grant reads and creation only; they expose no revoke, delete, or update operation. For orphaned identities (`managingOrganizationId = null`), the frozen grant set can neither expand nor contract through grant-management APIs; membership removal remains possible.

### Explicit organization switch

1. The switch action receives the target organization ID/slug and current route context.
2. Require active global identity and an active target membership.
3. Update only the current session's `activeOrganizationId`.
4. Return/redirect to the canonical `/org/[targetSlug]` path.
5. Rebuild the authorization snapshot from the target membership; do not reuse permissions from the previous organization.

A suspended/missing membership, deleted organization, or stale slug fails without changing the session. Switching is idempotent when already active.

### Session/URL mismatch

See the complete contract in [Deterministic active-organization contract](#deterministic-active-organization-contract). Mutations return `ORGANIZATION_CONTEXT_MISMATCH`. Safe reads show a mismatch/interstitial or redirect to a chooser according to the state table; they never mutate the session as a side effect.

### Membership suspension and reactivation

Count the target identity's active memberships inside the serializable transaction.

- If the count is greater than one, suspend only the selected membership. Clear `activeOrganizationId` from that identity's sessions currently pointing to the suspended organization. Other sessions/memberships remain valid.
- If the count is exactly one, set global `user.disabledAt`, delete all sessions, and leave the membership row intact for later global reactivation. This is the confirmed global-suspension rule.
- If the selected membership is already suspended, return idempotent success.
- Deny self-suspension where it would evade continuity controls. Deny any operation violating last-owner or last-administrator guarantees.

Reactivating a membership clears only membership suspension. Reactivating a globally suspended identity clears `disabledAt`; it does not silently reactivate separately suspended memberships or create a session. The actor needs the corresponding organization permission for a membership operation or a platform permission for an explicitly platform-level operation.

### Global suspension and reactivation

A platform-authorized global suspension sets `user.disabledAt` and deletes every session in one transaction, regardless of memberships. Organization roles do not grant this platform authority, except for the confirmed one-active-membership rule above, which is a distinct organization lifecycle operation. Global reactivation clears the identity flag only after checking that at least one valid membership/onboarding path remains; the user signs in again and explicitly selects an organization.

### Member removal and voluntary leave

- Target membership and organization are locked/read together.
- Removal and leave both enforce last-owner and administration continuity.
- Removing the current session's membership clears that session's active organization; removing another user's membership clears all of that user's sessions active in the organization.
- If the identity has no memberships after ordinary removal or leave, delete the identity and all sessions atomically with the membership removal. A rollback preserves the membership, identity, and sessions together.
- A restricted identity may leave/remove an allowlisted organization; its permanent allowlist grant remains unchanged.
- A restricted identity cannot leave or be removed from its still-existing managing organization while any other memberships remain. Return `MANAGING_MEMBERSHIP_REQUIRED`; organization deletion is the only operation that applies the frozen-orphan rule.
- Removal is idempotent when the membership is already absent, but callers receive no cross-tenant existence signal.

### Ownership transfer

Ownership transfer is one serializable operation:

1. Require the actor to be an active owner in the organization.
2. Require the recipient to be another active membership in the same organization.
3. Assign protected owner to the recipient before optionally removing owner from the actor.
4. Preserve at least one active owner and required administration capabilities throughout the transaction.
5. Update the Better Auth lifecycle-role projection atomically and audit old/new owners.

A transfer to a suspended member, cross-organization member ID, or stale membership fails. Concurrent transfers serialize on the organization/owner set.

### Organization deletion and the selected orphan rule

Deletion is an explicit destructive action available only to an active owner with deletion permission and strong confirmation. It runs through a product Server Action and server-only deletion adapter, never the stock Better Auth endpoint. Before any write, the action validates session/URL context, authorization, confirmation, and target existence. A denial returns without changing session state.

The database transaction locks the organization, memberships, restricted identities managed by it, allowlist grants, roles, invitations, and affected identities. For each identity affected by deleting organization `D`:

1. Remove/cascade the membership in `D` and cancel/delete pending invitations owned by `D` in the canonical Better Auth tables.
2. If no memberships remain because `D` is being deleted, delete the identity and its sessions under the confirmed organization-deletion rule.
3. If the identity is unrestricted and other memberships remain, keep the identity. Do not clear or switch its active organization inside the transaction.
4. If the identity is restricted and `D` is not its managing organization, keep it only if every remaining membership is still eligible under its existing manager/allowlist; an invariant violation aborts deletion for investigation.
5. If the identity is restricted and `D` is its managing organization:
   - If other allowlisted memberships remain, keep the identity only in those organizations, set `allowlistFrozenAt`, retain immutable identity/grant manager snapshots, and prohibit expansion. Deleting `D` then applies `ON DELETE SET NULL` to the live identity/grant manager references while grants to surviving targets remain; target-organization deletion still cascades its grant.
   - If no memberships remain, delete the identity and all sessions.

The same transaction deletes organization-owned custom roles and canonical invitations/memberships, performs account/orphan transitions, inserts deletion audit with immutable organization ID/slug/name snapshots, and deletes the canonical organization row. A rollback leaves all rows and surviving session state unchanged.

Only after commit does post-commit cleanup clear `activeOrganizationId = D` from surviving sessions; it never auto-switches to another organization. Cache/path revalidation follows that cleanup. If cleanup fails, context resolution treats the deleted active organization as stale and fails closed while an idempotent retry clears it. Sessions belonging to identities deleted in the transaction disappear with those identities; the post-commit ordering rule concerns surviving sessions.

## Deterministic active-organization contract

The session and URL are two claims that must agree, not fallback candidates.

### Resolution algorithm

For every protected organization route or mutation:

1. Authenticate and reject a globally suspended/deleted identity.
2. Resolve URL `organizationSlug` using the organization slug normalizer and exact stored slug.
3. Resolve session `activeOrganizationId` to an organization.
4. Resolve an active membership for `(session.userId, organization.id)`.
5. Continue only when URL organization ID equals session active organization ID and the membership is active.
6. Build authorization from that membership only.

### State outcomes

| Session active organization | URL organization      | Membership state       | Deterministic outcome                                                                                                                                 |
| --------------------------- | --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid A                     | A                     | Active                 | Render or mutate in A.                                                                                                                                |
| Valid A                     | B                     | Active in both         | Do not choose. GET shows a context-mismatch interstitial with explicit “switch to B” and “go to A”; mutation returns `ORGANIZATION_CONTEXT_MISMATCH`. |
| Valid A                     | B                     | Not active in B        | Return not-found/forbidden without revealing B, with a link back to A. Never switch.                                                                  |
| Missing/null                | Valid B               | Active in B            | Show organization chooser/switch confirmation. Do not silently set B.                                                                                 |
| Invalid/deleted/suspended A | Any                   | No active A membership | Clear stale active context, redirect to the organization chooser, and emit a context-invalidated event. This is cleanup, not selection.               |
| Valid A                     | Missing non-org route | Active                 | Canonical entry route may redirect to `/org/[slugA]`; it does not change session state.                                                               |
| Valid A                     | Reserved/unknown slug | Any                    | Not found; do not change session.                                                                                                                     |
| None                        | None                  | No active memberships  | Onboarding/no-access state; never guess an organization.                                                                                              |

### Multi-tab behavior

`activeOrganizationId` is session-backed. Tabs sharing the same session also share the active organization. The last explicit switch wins for that session. A stale tab whose URL still names the old organization encounters the mismatch interstitial or mutation error on its next request; it is never silently authorized under either side. Separate browser/device sessions can hold different active organizations. If independent per-tab context becomes a product requirement, it requires a different session model and is outside this design.

## Authorization design

### Two authorization planes

| Plane        | Subject and scope                                         | Examples                                                                      | Source                                                                  |
| ------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Platform     | Global identity/platform operation; no tenant inheritance | Global suspension, platform support, bootstrap/emergency operations           | Separate platform assignments/configuration, never an organization role |
| Organization | One active membership in one validated organization       | Members, invitations, custom roles, organization settings, organization audit | Membership-role assignments plus global permission definitions          |

Every authorization API accepts/resolves an organization context explicitly. A permission snapshot includes `userId`, `organizationId`, `membershipId`, role keys/IDs, permissions, and membership state. Cache keys include session and organization; switching invalidates/rebuilds the snapshot.

### Definitions and assignments

- **Global permissions:** stable keys in `src/features/authorization/constants/permission-catalog.ts`; definitions are bootstrapped globally and classified as platform- or organization-scoped.
- **Protected organization permissions:** permanent restriction and allowlist-grant administration permissions are assignable only through protected roles, never custom organization roles.
- **Protected roles:** global role definitions (`owner`, `admin`, `member`) with stable keys and protected permission sets. They cannot be renamed, edited, or deleted. Their definitions use organization scope with no owning organization; assignment remains membership-scoped.
- **Custom roles:** owned by one organization and restricted to organization-level permissions. Their key need be unique only within that organization.

- **Assignments:** always reference a membership. A protected role can be assigned in many organizations, but each assignment is distinct.
- **Role deletion:** protected roles cannot be deleted. A custom role cannot be deleted while assigned or referenced by a pending invitation; remove/reassign those references first.
- **Invitation roles:** validated again at acceptance so deleted/changed custom roles produce `INVITATION_ROLE_STALE`, not an invalid assignment.

The confirmed protected organization-role grants are:

| Role     | Exact permission set                                                                                                                                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`  | Every permission in the catalog with `scope = organization`.                                                                                                                                                                |
| `admin`  | Every organization-scoped permission except `organization.delete`, `organization.ownership.transfer`, `organization.restrictions.create`, `organization.allowlist-grants.read`, and `organization.allowlist-grants.create`. |
| `member` | `organization.read` and `organization.members.read` only.                                                                                                                                                                   |

None of these roles includes a platform-scoped permission. The platform `admin` and `member` role definitions remain distinct and unchanged. Bootstrap creates only the global role definitions and their permission links; membership-role assignments are a separate lifecycle operation.

### Owner and administrator continuity

- An organization must always retain one active owner (MO-SEC-015).
- Owner has all organization lifecycle permissions and satisfies administrator continuity.
- Role, access, suspension, removal, leave, and transfer operations calculate post-transaction effective permissions.
- If the target currently supplies the final active principal for any required management capability, the operation fails with `LAST_ACTIVE_ADMIN` unless another active principal will hold it in the same transaction.
- Checks run under serializable isolation/equivalent locks to prevent two concurrent demotions from both passing.

### Audit boundary

Every organization mutation records the organization, actor identity, actor membership when membership authority was used, target, outcome/reason, and correlation ID. Invitation-recipient actions have no target-organization membership yet and record a null actor membership. Denials for cross-tenant access, allowlist changes, continuity, deletion, and context mismatch are audit-worthy. Ordinary denied reads may be metric-only to control volume, but high-risk reads such as organization audit export are recorded.

## Better Auth Organization boundary

Integration reference: [Better Auth Organization plugin documentation](https://www.better-auth.com/docs/plugins/organization). Repository inspection confirmed the installed package is exactly `better-auth` **1.6.25**; the following boundary is based on its shipped runtime and types, not only the declared `^1.6.25` range. Evidence was read from `node_modules/better-auth/package.json`, the shipped Organization `crud-invites.mjs`, `crud-org.mjs`, and `types.d.mts`, the API router/dispatcher runtime, and `@better-auth/core`'s `BetterAuthOptions` types.

### Installed 1.6.25 behavior that determines the boundary

- `POST /organization/accept-invitation` calls `beforeAcceptInvitation`, then changes the canonical invitation from `pending` to `accepted` **before** entering its member transaction. That transaction creates the member and calls `setActiveOrganization` for the accepting session. Its catch handler attempts a compensating status reset, but invitation acceptance is not part of the member transaction. Therefore this endpoint cannot provide MO-SEC-007 atomicity or the no-switch requirement.
- `POST /organization/delete` checks authorization and then, when deleting the active organization, calls `setActiveOrganization(..., null)` **before** loading the organization and invoking `beforeDeleteOrganization`. Therefore that lifecycle hook cannot safely deny deletion while preserving session state.
- `BetterAuthOptions.disabledPaths?: string[]` is a supported HTTP-router control. The 1.6.25 router normalizes the request path and returns 404 before endpoint dispatch when it matches.
- `BetterAuthOptions.hooks.before` is a supported early middleware. The 1.6.25 endpoint dispatcher runs it for both routed requests and `auth.api.*` calls before the endpoint handler. It can reject based on `ctx.path`.
- Organization option `disableOrganizationDeletion?: boolean` is supported, and the stock deletion handler checks it before session lookup or mutation.

There is therefore **no interception blocker** in the installed API. Until product-owned context and policy handlers exist, the global `hooks.before` middleware rejects every `/organization/...` endpoint through routed HTTP and direct `auth.api.*` dispatch. For HTTP requests, exact normalized `disabledPaths` for `/organization/accept-invitation` and `/organization/delete` take precedence and return 404 before the hook; direct API calls to those mutations are rejected by the global guard. Keep exact normalized `/organization/accept-invitation` and `/organization/delete` entries in `disabledPaths` as additional HTTP defense, and set Organization `disableOrganizationDeletion: true` as deletion-specific defense in depth. Revisit the broad guard only when each endpoint has a product-owned authorized replacement; never expose stock invitation acceptance or deletion. `beforeAcceptInvitation` and `beforeDeleteOrganization` are not guards for these mutations and must not be presented as such.

The plugin's `organizationLimit` uses `MAX_ORGANIZATIONS_PER_USER` (100), and `invitationExpiresIn` uses the two-day policy converted to seconds. Better Auth's `membershipLimit` counts all persisted member rows, including suspended rows, so `AUTH_NONRESTRICTIVE_MEMBERSHIP_LIMIT` (`Number.MAX_SAFE_INTEGER`) is not the product's 1,000-active-member policy; product handlers must enforce that policy transactionally. Better Auth's default `invitationLimit` is 100, while product policy has no pending-invitation cap, so `AUTH_NONRESTRICTIVE_INVITATION_LIMIT` is also the shared `Number.MAX_SAFE_INTEGER` sentinel (not `Infinity`).

### Better Auth owns

- Canonical `organization`, `member`, and `invitation` model/schema integration.
- Session `activeOrganizationId` storage. The product switch action validates active membership and conditionally updates only the authenticated current session (session ID, user ID, and observed active context); it does not invoke the blocked stock set-active endpoint.
- Compatible stock lifecycle operations such as organization creation/update, invitation creation/rejection/cancellation, and member reads, subject to product policy hooks.
- Invitation expiry/limit options, invitation email callback, baseline lifecycle roles/access checks, and matching client types.

Better Auth does **not** own product invitation acceptance or organization deletion execution in this design. During MO-IMPL-002, every stock organization-plugin endpoint (including reads) remains unreachable until context and policy handlers exist; product-owned handlers may later selectively replace supported endpoints, but stock invitation acceptance and deletion stay unreachable.

### Product code owns

- Product Server Actions and server-only transactional adapters for invitation acceptance and organization deletion.
- Public self-service versus administrator-provisioned onboarding semantics.
- Immutable restriction, managing organization, frozen-orphan state, and allowlist grants.
- Checks at invitation creation and transactional acceptance.
- No-self-whitelist and no-recipient-organization-self-authorization policy.
- Global versus membership suspension and session invalidation.
- Global permission definitions, protected/custom product roles, membership-role assignments, continuity rules, and authorization snapshots.
- Session/URL agreement, slug reservation, route composition, audit, observable reason codes, revalidation, and deletion consequences for identities.

### Relevant hooks and controls

| Better Auth control/hook                                                     | Product use                                                                                                                                                                                |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `disabledPaths`                                                              | Disable stock acceptance/deletion HTTP paths; this does not govern direct `auth.api.*` dispatch.                                                                                           |
| Global `hooks.before`                                                        | Temporarily reject every `/organization/...` path before HTTP or `auth.api.*` endpoint handlers execute, including reads.                                                                  |
| `disableOrganizationDeletion`                                                | Keep stock organization deletion disabled before it can clear session context; defense in depth behind the global guard.                                                                   |
| `allowUserToCreateOrganization`, `organizationLimit`, `creatorRole`          | Plugin creation is limited to 100 organizations per user; reachable creation paths must separately enforce onboarding policy.                                                              |
| `membershipLimit`, `invitationLimit`, `invitationExpiresIn`                  | Use nonrestrictive sentinels for row-count and invite-count caps; enforce 1,000 active members transactionally in product code. Set invitation expiry to exactly two days; no pending cap. |
| `sendInvitationEmail`                                                        | Send the product invitation URL containing an opaque invitation ID; never log the capability.                                                                                              |
| `cancelPendingInvitationsOnReInvite`                                         | Implement the replacement-resend architecture default if product keeps it.                                                                                                                 |
| `requireEmailVerificationOnInvitation`                                       | Require verified ownership before supported invitation-by-ID actions; the custom acceptance adapter enforces equivalent verified-identity policy directly.                                 |
| `beforeCreateOrganization`, `beforeUpdateOrganization`                       | Enforce organization-creation/update eligibility, normalized slug, reserved names, and limits on reachable stock paths.                                                                    |
| `beforeAddMember`, `beforeRemoveMember`, `beforeUpdateMemberRole`            | Defend reachable member lifecycle paths with restricted eligibility, continuity, membership, and tenant checks.                                                                            |
| `beforeCreateInvitation`, `beforeRejectInvitation`, `beforeCancelInvitation` | Enforce inviter/recipient scope, recipient restriction, limits, role validity, and audit context on reachable invitation paths.                                                            |
| Corresponding `after*` hooks                                                 | Emit post-commit observability or synchronize safe projections only. Security and transactional audit must not depend solely on an `after*` hook.                                          |

### Product-owned canonical-table adapters

The acceptance and deletion adapters are server-only modules owned by `src/features/organizations/lib/`. They use the application's database transaction primitive over the configured Better Auth tables and product policy tables; they do not invoke the blocked endpoint handlers. This is not a parallel lifecycle store: row shapes, IDs, role projection, statuses, constraints, and subsequent Better Auth reads remain canonical.

Keep exactly one physical organization table, one physical member table, and one physical invitation table. Product code may add fields and related policy tables, but must not create `organization_members`, `tenant_users`, or product invitation duplicates. Adapter integration tests read results back through supported Better Auth organization reads and directly assert the canonical constraints. Cached display projections remain non-authoritative and disposable.

## Repository ownership and expected file impact

This map follows `AGENTS.md`: route files compose, features own behavior, and no `shared`, `common`, or generic feature bucket is introduced.

### New `src/features/organizations` public API

Only public entrypoints live at the feature root.

| Path                                      | Responsibility                                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/organizations/client.ts`    | Export organization switcher, invitation, member, and settings client islands only.                                                            |
| `src/features/organizations/server.ts`    | Export server-only context resolution, reads, and organization lifecycle operations.                                                           |
| `src/features/organizations/contracts.ts` | Export-only boundary for serializable organization/member/invitation/action contracts.                                                         |
| `src/features/organizations/actions/`     | Responsibility-named Server Actions for switching, invitations, provisioning, membership access, ownership, allowlist, and deletion.           |
| `src/features/organizations/components/`  | Named islands such as `OrganizationSwitcher`, `OrganizationContextMismatch`, `MemberAdministration`, and invitation acceptance UI.             |
| `src/features/organizations/data/`        | Organization-scoped reads with mandatory organization predicates.                                                                              |
| `src/features/organizations/interfaces/`  | Serializable result, summary, and context types re-exported by `contracts.ts`.                                                                 |
| `src/features/organizations/schemas/`     | One file per input schema: slug, switch, invitation, provisioning, allowlist, ownership, and deletion.                                         |
| `src/features/organizations/lib/`         | Server-only lifecycle/context policy, stock-endpoint guard composition, and responsibility-named canonical-table acceptance/deletion adapters. |
| `src/features/organizations/constants/`   | Reserved organization slugs and organization-specific stable error keys, only if required.                                                     |
| `src/features/organizations/email/`       | Organization invitation/activation email composition if ownership is not retained by auth.                                                     |

No empty directories should be created in advance.

### Existing areas

| Area                                                                | Expected changes during implementation                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/db/schema.ts`, `src/db/drizzle.ts`                             | Add/configure canonical plugin models, policy tables/fields, relations, constraints, and indexes. Platform roles use `platform_role_assignment`; organization roles use `membership_role`.                                                                        |
| `src/features/auth/server.ts`                                       | Install Organization plugin, expose inferred session fields, gate sessions by global status, configure `disabledPaths`, global `hooks.before`, and `disableOrganizationDeletion`, and integrate only safe lifecycle hooks/onboarding.                             |
| `src/features/auth/lib/auth-client.ts`                              | Install the matching Organization client plugin and expose only needed client operations.                                                                                                                                                                         |
| `src/features/auth/components/sign-up-form.tsx`, auth schemas/email | Add personal-organization onboarding and invitation-resume behavior while retaining Better Auth's required client signup boundary.                                                                                                                                |
| `src/features/authorization`                                        | Keep global permission catalog; scope role definitions/assignments, snapshots, policies, actions, and listings to validated memberships. Separate platform checks from organization checks.                                                                       |
| `src/features/app-shell`                                            | Add organization switcher and slug-aware navigation; receive serializable organization context from the server shell.                                                                                                                                             |
| `src/app/(app)`                                                     | Replace organization-protected routes with server route entries under `src/app/(app)/org/[organizationSlug]/...`; layouts authenticate, resolve context, redirect/error, fetch, and compose only. Keep global profile/account routes global only where justified. |
| `src/app/api/auth/[...all]/route.ts`                                | Continue as Better Auth's framework handler; do not add app-owned mutations.                                                                                                                                                                                      |
| `scripts/bootstrap-authorization.ts`                                | Bootstrap global permissions/protected role definitions without assigning every identity globally.                                                                                                                                                                |
| `scripts/grant-admin.ts`                                            | Require an explicit organization and create a membership-scoped assignment, or be replaced by a clearly platform-scoped emergency tool. No ambiguous global admin grant.                                                                                          |
| `messages/en.json`, `messages/es.json`                              | Add matched strings for organizations, switching, provisioning, invitations, context errors, restriction, continuity, and deletion.                                                                                                                               |
| `tests/`                                                            | Mirror organization, auth, authorization, routing, shell, and deletion behavior under top-level test directories.                                                                                                                                                 |

Cross-feature imports use `client.ts`, `server.ts`, or `contracts.ts`. Auth may expose Better Auth primitives through its existing public boundaries; organizations and authorization must not deep-import one another.

## Implementation work units

Each unit is independently reviewable. Behavior units require test-first RED/GREEN unless marked structural. Roll back a unit by reverting only its listed schema/code/tests before starting the next dependent unit; the database is disposable during this effort.

| Unit                                                            | Outcome                                                                                                                                                                                                                                               | Likely edit surfaces                                                                                                                      | Deterministic checks                                                                                                                                                               | Rollback boundary                                                                    | Review risks / TDD                                                                                                                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Contract and policy foundation (MO-IMPL-001)**             | Freeze stable permission planes, route-derived reserved slugs, 100 organizations per user, 1,000 active members per organization, exact two-day invitations without a pending cap, permanent allowlist grants, and final-membership identity cleanup. | `docs/`, authorization constants/interfaces, organization policy constants/utilities, focused unit tests                                  | Unit tests for limits, Unicode/case/empty/length slug policy, reserved values, permission-plane classification, and protected grant/restriction authority                          | No runtime integration yet                                                           | RED/GREEN for pure policy; no schema, route, or auth-flow changes.                                                                                                                    |
| **2. Canonical schema and Better Auth plugin**                  | One organization/member/invitation store; session active org; nullable manager references plus immutable snapshots; role/assignment/grant/audit tables; stock acceptance/deletion blocked.                                                            | `src/db/schema.ts`, auth server/client config, generated migration, schema tests                                                          | Schema generation; unique/FK/check/index assertions; `SET NULL`/target cascade tests; HTTP and `auth.api` stock-endpoint guard tests; type-check                                   | Reset DB and revert schema/plugin together                                           | Highest risk: duplicate stores, contradictory cascades, missing direct-call guard, plugin-version mismatch. RED/GREEN for constraints and guards; migration generation is structural. |
| **3. Bootstrap definitions**                                    | Global permissions and protected roles exist; platform member/admin grants use `platform_role_assignment`, and organization grants use membership assignments.                                                                                        | `scripts/bootstrap-authorization.ts`, `scripts/grant-admin.ts`, authorization catalog                                                     | Idempotent bootstrap test; explicit platform grant test; no legacy `user_role` writes                                                                                              | Scripts and seed rows only                                                           | Risk of accidental global admin. RED/GREEN required.                                                                                                                                  |
| **4. Organization context kernel**                              | One resolver enforces identity/session/URL/membership agreement and returns typed context.                                                                                                                                                            | `src/features/organizations/server.ts`, `contracts.ts`, `interfaces/`, `lib/`, routing tests                                              | Matrix for match, mismatch, null, deleted, suspended, forged slug                                                                                                                  | No UI dependency; revert resolver/routes                                             | Security-critical. RED for every denial branch, then GREEN.                                                                                                                           |
| **5. Self-service onboarding and provisioning**                 | Three identity modes work with compensation/idempotency and no unintended personal org.                                                                                                                                                               | auth signup files; organization actions/lib/schemas; email; DB hooks                                                                      | Self-service owner, unrestricted provision, restricted provision, duplicate/race/delivery-failure tests                                                                            | Revert onboarding actions/hooks as one unit                                          | Risk of usable orphan identity and restriction mutability. RED/GREEN required.                                                                                                        |
| **6. Organization routing and shell**                           | `/org/[slug]` composition, explicit switcher, mismatch UI, slug-aware navigation.                                                                                                                                                                     | `src/app/(app)/org/[organizationSlug]`, `src/features/app-shell`, organization components, messages                                       | Server routing and component tests; URL manipulation; multi-tab/session simulation                                                                                                 | Revert routes/shell while context kernel remains                                     | Risk of silent switching or client-only authorization. RED/GREEN for behavior.                                                                                                        |
| **7. Tenant-scoped authorization and roles**                    | Snapshots are membership-bound; protected/custom roles and assignment continuity work.                                                                                                                                                                | `src/features/authorization`, organization role actions/contracts, admin routes                                                           | Cross-tenant denial, stale snapshot, protected/custom role, role deletion, last-owner/admin race tests                                                                             | Revert authorization actions/schema additions together                               | Risk of ID-only reads and projection drift. RED/GREEN required.                                                                                                                       |
| **8. Invitations and allowlist**                                | Canonical plugin invitations replace password-reset invitations; a product acceptance adapter provides atomic acceptance without switching; allowlist checks and actor rules hold.                                                                    | organization invitation/allowlist actions, server-only acceptance adapter, auth guards/email, old authorization invitation code, messages | Blocked stock route/direct API; custom atomic accept/rollback; active-org preservation; retry/idempotency; canonical readback; expiry/cancel/resend/replay/capacity/race tests     | Revert adapter/action while stock acceptance remains blocked                         | Risk of endpoint bypass, non-atomic status/member writes, session mutation, and token leakage. RED/GREEN required.                                                                    |
| **9. Membership lifecycle**                                     | Suspension/reactivation, remove/leave, ownership transfer, and session invalidation follow state rules.                                                                                                                                               | organization actions/lib/data, authorization continuity policy, shell context                                                             | One-vs-many membership suspension, last-owner/admin, session clearing, idempotency/concurrency tests                                                                               | Revert lifecycle actions as a cohesive unit                                          | Security and concurrency risk. RED/GREEN required.                                                                                                                                    |
| **10. Organization deletion and orphan handling**               | A product deletion adapter enforces canonical deletion/account transitions and frozen restricted-orphan semantics before post-commit session cleanup.                                                                                                 | organization deletion action/adapter/policy, DB relations, auth guards, audit, cleanup tests                                              | Blocked stock route/direct API; denial without session mutation; full deletion matrix; rollback injection; post-commit session cleanup; snapshots and surviving-target grant tests | Keep stock deletion disabled and revert custom action/adapter if any invariant fails | Highest destructive risk: pre-hook session clearing, cascade loss, and partial cleanup. RED/GREEN and transaction-failure tests required.                                             |
| **11. Operations, localization, and proportional verification** | Metrics/audit/runbook/messages complete; full integration/build checks pass.                                                                                                                                                                          | messages, tests, operational docs/config already approved for implementation                                                              | Locale parity, audit redaction, build/type/lint/full relevant tests                                                                                                                | Revert observability/UI polish independently; do not weaken security to pass         | Mostly integration/build; use RED/GREEN for any new behavior, structural checks for docs/messages.                                                                                    |

## Scenario and test matrix

Tests live under `tests/` and assert behavior, not file existence or implementation details.

| Tier              | Scenario                           | Expected assertion                                                                                                                                                                                                         |
| ----------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit              | Email and username normalization   | Global uniqueness inputs normalize consistently; collisions fail.                                                                                                                                                          |
| Unit              | Organization slug normalization    | Separate rules, case/Unicode handling, reserved names, empty output, and maximum length are deterministic.                                                                                                                 |
| Unit              | Slug collisions                    | Existing normalized slug and concurrent insert return `ORGANIZATION_SLUG_TAKEN`; no suffix race bypasses DB uniqueness.                                                                                                    |
| Unit              | Restricted eligibility             | Manager, granted org, ungranted org, and frozen orphan cases implement MO-SEC-005/010.                                                                                                                                     |
| Unit              | Allowlist actors                   | Self-whitelist and recipient-org authorization fail; authorized different managing-org actor passes.                                                                                                                       |
| Unit              | Frozen allowlist persistence       | Manager deletion sets live identity/grant manager FKs null, retains immutable manager snapshots and `allowlistFrozenAt`, preserves surviving-target grants, and cascades grants only when their allowed target is deleted. |
| Unit              | Authorization plane                | Organization permissions never satisfy platform permission checks.                                                                                                                                                         |
| Unit              | Role validity                      | Protected/global role and same-org custom role pass; foreign-org custom role fails.                                                                                                                                        |
| Unit              | Last owner/admin                   | Demotion, suspension, removal, leave, and role deletion preserve continuity.                                                                                                                                               |
| Unit              | Serializable result mapping        | Known failures map to stable safe codes; unknown errors become generic codes without leaking details.                                                                                                                      |
| Server            | Self-signup                        | Identity, personal org, owner membership, assignments, active context, and verification order are correct.                                                                                                                 |
| Server            | Signup races                       | Duplicate email, username, and slug races create no orphan identity or duplicate organization.                                                                                                                             |
| Server            | Admin provisioning unchecked       | No personal org; only active-org membership; unrestricted user can later accept another invite.                                                                                                                            |
| Server            | Admin provisioning checked         | No personal org; restriction immutable; managing organization fixed; direct bypass denied.                                                                                                                                 |
| Server            | Provisioning delivery failure      | Pending identity/membership survive once; resend is idempotent; sign-in remains blocked until activation.                                                                                                                  |
| Server            | Existing-user invitation           | Membership is not created before acceptance; target roles are tenant-valid.                                                                                                                                                |
| Server            | New-user invitation signup         | Under the architecture default, personal org is created first; invitation acceptance creates a second membership and does not switch.                                                                                      |
| Server            | Invitation denial                  | Recipient/email/expiry/restriction/limit/role denial creates no membership or audit success, leaves invitation pending, and leaves every session field unchanged.                                                          |
| Server            | Custom acceptance atomicity        | Failure injected after each write rolls back invitation, canonical member, membership roles, and audit together.                                                                                                           |
| Server            | Acceptance active-org preservation | Success leaves the accepting session's `activeOrganizationId` byte-for-byte unchanged and exposes switching only as a separate action.                                                                                     |
| Server            | Invitation lifecycle               | Accept/reject/cancel are terminal; expiry is enforced at read time; replacement resend invalidates the old token under the architecture default.                                                                           |
| Server            | Invitation race/idempotency        | Concurrent accepts create one membership; retry returns `changed: false` only for a consistent accepted invitation/member projection.                                                                                      |
| Server            | Acceptance canonical consistency   | Product acceptance writes the configured Better Auth invitation/member rows; supported Better Auth reads observe exactly one accepted invitation and member, with no parallel record.                                      |
| Server            | Membership capacity/invite expiry  | The 1,000th active membership succeeds once, concurrent overflow is denied transactionally, invitations expire at exactly two days, and pending invitation count is uncapped.                                              |
| Server            | Organization switching             | Only active memberships can be selected; switch updates current session and rebuilds context.                                                                                                                              |
| Server            | Session invalidation               | Global suspension deletes all sessions; membership suspension clears sessions active in that org only.                                                                                                                     |
| Server            | Suspension cardinality             | One active membership triggers global suspension; more than one suspends only selected membership.                                                                                                                         |
| Server            | Reactivation                       | Global and membership reactivation affect only their own state and create no session.                                                                                                                                      |
| Server            | Removal/leave                      | Sessions are cleared and continuity/managing-membership rules deny unsafe operations; final-membership removal atomically deletes the identity and all sessions.                                                           |
| Server            | Ownership transfer                 | Recipient is same-org active member; owner continuity holds under concurrent transfer/demotion.                                                                                                                            |
| Server            | Role deletion                      | Protected role denied; assigned or invitation-referenced custom role denied; unassigned same-org role deleted.                                                                                                             |
| Server            | Organization deletion              | Sole-membership identities deleted; multi-org unrestricted identities survive; surviving sessions clear deleted active context only after commit.                                                                          |
| Server            | Deletion denial/session safety     | Authorization, confirmation, continuity, or invariant denial leaves organization data and all session active-organization values unchanged.                                                                                |
| Server            | Restricted orphan deletion         | Other allowlisted memberships and grants survive, live manager FKs become null, immutable snapshots remain, and `allowlistFrozenAt` prevents expansion; no remaining membership deletes identity/sessions.                 |
| Server            | Deletion rollback                  | Failure injected before commit leaves organization, identities, grants, roles, invitations, sessions, and audit in a consistent pre-transaction state; post-commit cleanup is not run.                                     |
| Server            | Cross-tenant isolation             | IDs from another tenant cannot be read, updated, assigned, canceled, suspended, or inferred through response differences.                                                                                                  |
| Component         | Organization switcher              | Lists active memberships only; loading/error/suspended states are accessible; selection calls explicit switch.                                                                                                             |
| Component         | Context mismatch                   | Shows both safe choices, performs no automatic switch, and does not render protected child content.                                                                                                                        |
| Component         | Provisioning form                  | Restricted checkbox meaning is explicit and immutable; permission-gated controls are absent/disabled correctly.                                                                                                            |
| Component         | Invitation UI                      | Existing/new identity flow, terminal states, resend delivery failure, and stale invitation messages are clear.                                                                                                             |
| Component         | Member/role UI                     | Organization-only data; protected-role controls; last-owner/admin errors; role deletion denial.                                                                                                                            |
| Integration       | URL manipulation                   | Changing slug by hand never reuses permissions or data from session organization; mutation fails mismatch.                                                                                                                 |
| Integration       | Multi-tab session                  | Explicit switch in tab B makes stale tab A hit mismatch; no silent data crossover.                                                                                                                                         |
| Integration       | Blocked stock HTTP endpoints       | Both stock POST paths return 404/rejection before acceptance/deletion side effects; denied deletion leaves session state unchanged.                                                                                        |
| Integration       | Blocked stock direct API           | Direct `auth.api.acceptInvitation` and `auth.api.deleteOrganization` calls are rejected by global `hooks.before`; deletion's disable option remains enabled.                                                               |
| Integration       | Canonical-table readback           | Custom acceptance/deletion results agree with supported Better Auth organization reads and uniqueness/FK constraints; no shadow store exists.                                                                              |
| Integration       | Stale invitation roles             | Deleted/changed custom role causes safe stale-role error and no membership.                                                                                                                                                |
| Integration       | Audit                              | Successful and high-risk denied operations record correct organization/member/correlation data and no secrets.                                                                                                             |
| Integration       | Reset/bootstrap                    | Empty database migrates/generates, bootstraps idempotently, then supports first self-service and explicit org-admin grant.                                                                                                 |
| Integration/build | Locale/type/build                  | English/Spanish keys match; server-only boundaries and serializable props type-check; production build succeeds.                                                                                                           |

Grant-policy tests must prove there is no revoke operation and that orphan-frozen grants cannot be changed. Final-membership removal tests must verify identity/account/session deletion is atomic and does not alter the separately confirmed organization-deletion path.

## Serializable Server Action result semantics

Server Actions return discriminated, serializable outcomes. They do not throw expected policy or validation failures across the client boundary.

### Shape rules

| Field           | Rule                                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `success`       | Boolean discriminator.                                                                                          |
| `data`          | Present only on success; contains IDs/status/redirect path needed by the caller, never DB objects or SDK types. |
| `code`          | Stable uppercase machine code on failure. Safe for localization lookup and tests.                               |
| `fieldErrors`   | Optional record of input field to string-array; validation failures only.                                       |
| `retryable`     | Optional boolean for delivery/transient conflicts; does not authorize blind retry of destructive actions.       |
| `correlationId` | Present for operational support on unexpected failures and high-risk operations.                                |

Dates cross the boundary as ISO strings. IDs and slugs are strings. No `Error`, `Date`, `Map`, database row, Request, session token, or invitation token is returned.

### Stable error families

| Family                 | Representative codes                                                                                                                                     | Semantics                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Authentication/context | `UNAUTHORIZED`, `IDENTITY_SUSPENDED`, `NO_ACTIVE_ORGANIZATION`, `ORGANIZATION_CONTEXT_MISMATCH`, `MEMBERSHIP_INACTIVE`                                   | Caller must authenticate, choose/switch explicitly, or regain access.                                |
| Existence/isolation    | `NOT_FOUND`, `ORGANIZATION_NOT_FOUND`                                                                                                                    | Use non-enumerating responses for foreign-tenant objects.                                            |
| Validation/conflict    | `VALIDATION_ERROR`, `DUPLICATE_EMAIL`, `DUPLICATE_USERNAME`, `ORGANIZATION_SLUG_TAKEN`, `RESERVED_ORGANIZATION_SLUG`                                     | Safe client-correctable input.                                                                       |
| Restriction/allowlist  | `ORGANIZATION_RESTRICTED`, `ALLOWLIST_REQUIRED`, `ALLOWLIST_FROZEN`, `SELF_ALLOWLIST_FORBIDDEN`, `RECIPIENT_ORG_AUTHORIZATION_FORBIDDEN`                 | Stable mappings to MO-SEC-004 through MO-SEC-010.                                                    |
| Invitation             | `INVITATION_NOT_PENDING`, `INVITATION_EXPIRED`, `INVITATION_RECIPIENT_MISMATCH`, `INVITATION_ROLE_STALE`, `ALREADY_MEMBER`, `INVITATION_DELIVERY_FAILED` | Delivery failure is retryable through explicit resend; stale/terminal capabilities are not replayed. |
| Capacity/continuity    | `ORGANIZATION_LIMIT_REACHED`, `MEMBERSHIP_LIMIT_REACHED`, `LAST_ACTIVE_OWNER`, `LAST_ACTIVE_ADMIN`, `MANAGING_MEMBERSHIP_REQUIRED`                       | Transaction made no unsafe state change.                                                             |
| Roles                  | `PROTECTED_ROLE`, `FOREIGN_ORGANIZATION_ROLE`, `ROLE_ASSIGNED`, `ROLE_NOT_FOUND`                                                                         | Role scope/lifecycle failures.                                                                       |
| Generic                | `FORBIDDEN`, `CONFLICT`, `OPERATION_FAILED`                                                                                                              | No internal SQL, hook, or provider detail is exposed. Log with correlation ID.                       |

A successful idempotent retry may include `changed: false`. Unexpected exceptions are logged server-side and returned as `OPERATION_FAILED`; raw Better Auth or database messages never become client codes without an explicit mapping.

## Operations, audit, and observability

### Audit requirements

Audit at minimum:

- Organization create/update/delete and slug changes.
- Provisioning mode and restriction selection.
- Permanent allowlist grant creation and denied attempts to mutate existing grants.
- Invitation create/resend/accept/reject/cancel/expiry cleanup.
- Membership add/suspend/reactivate/remove/leave.
- Global suspension/reactivation.
- Role create/update/delete and assignment replacement.
- Ownership transfer and continuity denials.
- Explicit organization switch, stale-context clearing, and high-risk context mismatch.

Audit metadata uses IDs and bounded state diffs. Do not record passwords, reset links, invitation capabilities, session tokens, full request headers, or unnecessary personal data.

### Metrics and logs

- Counters by stable result code for invitation, provisioning, switching, restriction, and lifecycle operations.
- Gauge/count of onboarding records requiring compensation, expired pending invitations, and role-projection mismatches.
- Alerts for any MO-SEC invariant violation, deletion rollback, repeated cross-tenant denial, direct-plugin bypass attempt, or orphaned restricted identity with an expanding allowlist.
- Structured logs include correlation ID, actor user/member ID, organization ID, action, outcome, and invariant ID where applicable.
- Email provider failures are separate from transaction failures so operators can resend without duplicating state.

### Background maintenance

- Mark/report expired invitations; acceptance remains time-safe without the job.
- Retry or compensate incomplete onboarding/provisioning units using idempotency keys.
- Verify membership lifecycle-role projection against canonical assignments and fail closed on drift.
- Periodically assert: no restricted active membership outside eligibility; every organization has an active owner; every session active organization has an active membership; and no active identity exists without a membership.

## Database reset and bootstrap order

Because compatibility is not required, use a clean reset rather than a data migration.

1. Stop application writers and record the target schema/version.
2. Reset the disposable database.
3. Apply/generate the Better Auth core plus Organization target schema, including product policy tables and constraints.
4. Bootstrap global permission definitions.
5. Bootstrap protected role definitions and their permission links.
6. Validate that no legacy `user_role` table or duplicate membership/invitation tables exist, and that platform and membership assignments remain separate.
7. Start the application and create the first self-service identity/personal organization.
8. Use an explicit organization-scoped bootstrap/grant procedure for any required initial organization administrator; record audit with a platform/bootstrap actor.
9. Run invariant queries and the focused integration/build checks before enabling organization deletion or admin provisioning.

Rollback during development is another database reset to the last known schema plus bootstrap. There is no row-level downgrade/backfill promise.

## Acceptance checklist

- [ ] Database can start empty; no legacy data compatibility or backfill is implemented.
- [ ] Email and username are globally unique; organization slug has independent normalization, reserved-name checks, and DB uniqueness.
- [ ] Better Auth Organization models are the only organization/member/invitation persistence.
- [ ] Stock acceptance and deletion are blocked at HTTP and `auth.api` boundaries; deletion-specific disablement remains enabled.
- [ ] Product acceptance atomically updates canonical invitation/member/role/audit rows and never mutates active organization.
- [ ] Product deletion validates before writing, commits canonical deletion/orphan transitions atomically, and clears surviving session context only after commit.
- [ ] Public signup creates exactly one personal organization and owner membership.
- [ ] Both admin-provisioned modes create no personal organization and start only in the actor's active organization.
- [ ] Restriction cannot be removed or transferred to another managing organization.
- [ ] Allowlist policy is enforced on invitation creation, acceptance, and every member-add path; grants are permanent and no revoke operation exists.
- [ ] Self-whitelisting and recipient-organization self-authorization are denied.
- [ ] Invitation creators select the acceptance role, and role policy is revalidated at creation and acceptance.
- [ ] Invitations expire exactly two days after creation with no pending-invitation count cap.
- [ ] Organization capacity is limited to 100 organizations per identity and 1,000 active members per organization.
- [ ] Session and URL context mismatch never silently switches or chooses an organization.
- [ ] Every tenant-bound read/mutation includes organization scope and cross-tenant tests; documented context-establishing exceptions enforce their own identity/invitation/membership contract.
- [ ] Role assignments target memberships; custom roles cannot cross organizations.
- [ ] Platform and organization authorization are separate.
- [ ] Last active owner/admin guarantees survive concurrent mutations.
- [ ] Suspension follows the one-active-membership global rule and invalidates the correct sessions.
- [ ] Removing or leaving the final membership atomically deletes the identity and all sessions.
- [ ] Invitation terminal states, expiry, replacement resend, races, and stale roles are deterministic.
- [ ] Organization deletion applies the selected restricted-orphan rule atomically, preserving frozen grant/snapshot evidence without contradictory foreign-key cascades.
- [ ] Audit remains attributable after organization deletion and contains no capabilities/secrets.
- [ ] English and Spanish messages, focused tests, type-check, and production build pass.

## Review checklist

Review in this order:

1. **Data ownership:** one plugin membership store; global identity separated from membership state.
2. **Tenant boundary:** explicit organization predicates, session/URL agreement, and cross-tenant denials.
3. **Restriction boundary:** immutable flag, managing authority, both invitation checks, and frozen orphan behavior.
4. **Authorization:** membership assignments, protected/custom role scope, platform separation, and continuity transactions.
5. **Lifecycle:** provisioning, invitation, suspension, removal, transfer, and deletion failure behavior.
6. **Operations:** session invalidation, audit preservation/redaction, compensation, limits, races, and reset/bootstrap.
7. **Repository shape:** server route entries, named client islands, feature public APIs, no deep cross-feature imports or generic buckets.

## Decision classification summary

### Confirmed

The decisions listed in [Confirmed product decisions](#confirmed-product-decisions) are confirmed. They include permanent non-revocable grants, atomic identity/session deletion after ordinary final-membership removal or leave, creator-selected invitation roles validated at creation and acceptance, exact two-day invitations without a pending count cap, and the 100-organization/1,000-active-member limits.

### Architecture requirements

- Better Auth Organization tables are canonical, while stock 1.6.25 acceptance and deletion mutations are unreachable.
- Product adapters provide atomic acceptance/deletion semantics and auditable canonical-table consistency.
- Acceptance preserves active organization; explicit switching is a separate mutation.
- Tenant-bound operations require matching session/URL/membership context; the enumerated global, invitation-recipient, and context-establishing flows validate narrower contracts.
- Last-owner and administrator continuity checks are transactional.

### Architecture defaults

- A new invitation recipient follows public signup and receives a personal organization before acceptance.
- Resend replaces the old invitation capability.

Defaults guide implementation planning but remain distinguishable from confirmed product decisions.

## Defaults still open to product confirmation

Two defaults remain intentionally changeable: a new invitation recipient follows public signup and receives a personal organization before acceptance, and resend replaces the old invitation capability. Neither default changes the confirmed role, expiry, capacity, or permanent-grant policies.

## Confirmed operational values

- Maximum organizations per identity: 100.
- Maximum active members per organization: 1,000.
- Invitation lifetime: exactly two days from creation.
- Pending invitation count: uncapped.

## Next implementation step

With **MO-IMPL-001** complete, begin **Work Unit 2** test-first where constraints are executable: configure Better Auth Organization as the sole canonical store, install both stock-endpoint guards plus deletion-specific disablement, add nullable manager FKs and immutable snapshots, reset the database, and prove blocking, uniqueness, `SET NULL`/target cascade, and single-source-of-truth behavior before any UI or invitation work.
