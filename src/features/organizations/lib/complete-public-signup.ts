import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { member, membershipRole, organization, role, user } from "@/db/schema";
import { isReservedOrganizationSlug } from "../constants/organization-reserved-slugs";
import { normalizeOrganizationSlug } from "../utils/normalize-organization-slug";

const personalOrganizationId = (userId: string) => `personal-org-${userId}`;
const personalMembershipId = (userId: string) => `personal-member-${userId}`;

export async function compensateFailedPublicSignup(userId: string) {
  await db.transaction(async (tx) => {
    await tx
      .delete(organization)
      .where(
        and(
          eq(organization.id, personalOrganizationId(userId)),
          eq(organization.personalSignupOwnerUserId, userId)
        )
      );
    await tx.delete(user).where(eq(user.id, userId));
  });
}

export async function compensateFailedTrustedSignup(userId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(user).where(eq(user.id, userId));
  });
}

function slugCandidate(base: string, suffix: number) {
  if (suffix === 1) return base;
  const ending = `-${suffix}`;
  return `${base.slice(0, 63 - ending.length).replace(/-+$/, "")}${ending}`;
}

function validateUsernameSlug(username: string) {
  const normalized = normalizeOrganizationSlug(username);
  if (!normalized) throw new Error("PUBLIC_SIGNUP_USERNAME_SLUG_INVALID");
  return isReservedOrganizationSlug(normalized) ? `user-${normalized}` : normalized;
}

export async function completePublicSignup(userId: string, username: string, name: string) {
  const organizationId = personalOrganizationId(userId);
  const membershipId = personalMembershipId(userId);
  const slugBase = validateUsernameSlug(username);
  const displayName = `${name}'s organization`;

  return db.transaction(async (tx) => {
    const [adminRole] = await tx
      .select({ id: role.id })
      .from(role)
      .where(
        and(
          eq(role.id, "system:organization:admin"),
          eq(role.key, "admin"),
          isNull(role.organizationId),
          eq(role.scope, "organization"),
          eq(role.isProtected, true)
        )
      )
      .limit(1);

    if (!adminRole) throw new Error("PUBLIC_SIGNUP_ADMIN_ROLE_NOT_BOOTSTRAPPED");

    const [existingOrganization] = await tx
      .select({
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        personalSignupOwnerUserId: organization.personalSignupOwnerUserId,
      })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    let selectedOrganization = existingOrganization;
    if (existingOrganization) {
      if (
        existingOrganization.personalSignupOwnerUserId !== userId ||
        !hasExpectedPersonalOrganization(existingOrganization, slugBase, displayName) ||
        !(await hasConsistentAdministrator(tx, userId, membershipId, organizationId, adminRole.id))
      ) {
        throw new Error("PUBLIC_SIGNUP_ONBOARDING_STATE_INCONSISTENT");
      }
    } else {
      for (let suffix = 1; ; suffix += 1) {
        const slug = slugCandidate(slugBase, suffix);
        const [slugOwner] = await tx
          .select({ id: organization.id })
          .from(organization)
          .where(eq(organization.slug, slug))
          .limit(1);

        if (slugOwner) continue;

        const [createdOrganization] = await tx
          .insert(organization)
          .values({
            id: organizationId,
            name: displayName,
            slug,
            personalSignupOwnerUserId: userId,
          })
          .onConflictDoNothing()
          .returning({
            id: organization.id,
            slug: organization.slug,
            name: organization.name,
            personalSignupOwnerUserId: organization.personalSignupOwnerUserId,
          });

        if (!createdOrganization) {
          const [racedOrganization] = await tx
            .select({
              id: organization.id,
              slug: organization.slug,
              name: organization.name,
              personalSignupOwnerUserId: organization.personalSignupOwnerUserId,
            })
            .from(organization)
            .where(eq(organization.id, organizationId))
            .limit(1);
          if (racedOrganization) {
            selectedOrganization = racedOrganization;
            if (
              racedOrganization.personalSignupOwnerUserId !== userId ||
              !hasExpectedPersonalOrganization(racedOrganization, slugBase, displayName) ||
              !(await hasConsistentAdministrator(
                tx,
                userId,
                membershipId,
                organizationId,
                adminRole.id
              ))
            ) {
              throw new Error("PUBLIC_SIGNUP_ONBOARDING_STATE_INCONSISTENT");
            }
            break;
          }
          continue;
        }

        selectedOrganization = createdOrganization;
        await tx.insert(member).values({
          id: membershipId,
          organizationId,
          userId,
          role: "admin",
          status: "active",
        });
        await tx.insert(membershipRole).values({
          membershipId,
          roleId: adminRole.id,
          assignedByMembershipId: null,
        });
        break;
      }
    }

    if (!selectedOrganization) throw new Error("PUBLIC_SIGNUP_ORGANIZATION_CREATE_FAILED");
    await tx
      .update(user)
      .set({ initialActiveOrganizationId: organizationId })
      .where(eq(user.id, userId));

    return selectedOrganization;
  });
}

function hasExpectedPersonalOrganization(
  current: { slug: string; name: string },
  slugBase: string,
  expectedName: string
) {
  const collisionSuffix = current.slug.startsWith(`${slugBase}-`)
    ? Number(current.slug.slice(slugBase.length + 1))
    : 0;
  const slugMatches =
    current.slug === slugBase ||
    (Number.isInteger(collisionSuffix) &&
      collisionSuffix >= 2 &&
      current.slug === slugCandidate(slugBase, collisionSuffix));
  return current.name === expectedName && slugMatches;
}

async function hasConsistentAdministrator(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  membershipId: string,
  organizationId: string,
  adminRoleId: string
) {
  const [activeAdministrator] = await tx
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(
      and(
        eq(member.id, membershipId),
        eq(member.organizationId, organizationId),
        eq(member.userId, userId),
        eq(member.status, "active")
      )
    )
    .limit(1);
  if (!activeAdministrator) return false;

  let roleId = adminRoleId;
  if (activeAdministrator.role === "owner") {
    const [legacyOwnerRole] = await tx
      .select({ id: role.id })
      .from(role)
      .where(
        and(
          eq(role.id, "system:organization:owner"),
          eq(role.key, "owner"),
          eq(role.scope, "organization"),
          isNull(role.organizationId),
          eq(role.isProtected, true)
        )
      )
      .limit(1);
    if (!legacyOwnerRole) return false;
    roleId = legacyOwnerRole.id;
  } else if (activeAdministrator.role !== "admin") {
    return false;
  }

  const [administratorAssignment] = await tx
    .select({ membershipId: membershipRole.membershipId })
    .from(membershipRole)
    .where(and(eq(membershipRole.membershipId, membershipId), eq(membershipRole.roleId, roleId)))
    .limit(1);
  return Boolean(administratorAssignment);
}
