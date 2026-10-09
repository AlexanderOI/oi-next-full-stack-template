import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { member, membershipRole, permission, role, rolePermission, user } from "@/db/schema";
import { PERMISSIONS } from "@/features/authorization/server";
import type { OrganizationMemberPage } from "../interfaces/organization-member";

const maxPageSize = 100;
export interface ListOrganizationMembersInput {
  organizationId: string;
  page: number;
  pageSize: number;
  search: string;
  includeIdentityDisabled?: boolean;
  sort: string;
  direction: "asc" | "desc";
}

export async function listOrganizationMembers({
  organizationId,
  page: requestedPage,
  pageSize: requestedPageSize,
  search,
  includeIdentityDisabled = false,
  sort,
  direction,
}: ListOrganizationMembersInput): Promise<OrganizationMemberPage> {
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number.isSafeInteger(requestedPageSize) ? requestedPageSize : 20)
  );
  const term = search.trim().slice(0, 100);
  const searchFilter = term
    ? or(
        ilike(user.name, `%${term}%`),
        ilike(user.email, `%${term}%`),
        ilike(user.username, `%${term}%`)
      )
    : undefined;
  const where = searchFilter
    ? and(eq(member.organizationId, organizationId), searchFilter)
    : eq(member.organizationId, organizationId);
  const [countResult] = await db
    .select({ total: count() })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(where);
  const total = Number(countResult?.total ?? 0);
  const sortableColumns = {
    name: user.name,
    email: user.email,
    username: user.username,
    status: member.status,
    createdAt: member.createdAt,
  } as const;
  const sortColumn = sortableColumns[sort as keyof typeof sortableColumns] ?? sortableColumns.name;
  const results = await db
    .select({
      id: member.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      status: member.status,
      createdAt: member.createdAt,
      invitedAt: user.invitedAt,
      disabledAt: user.disabledAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(where)
    .orderBy(direction === "desc" ? desc(sortColumn) : asc(sortColumn), asc(member.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const membershipIds = results.map((row) => row.id);
  const roleResults = membershipIds.length
    ? await db
        .select({ membershipId: membershipRole.membershipId, roleId: role.id, roleName: role.name })
        .from(membershipRole)
        .innerJoin(role, eq(membershipRole.roleId, role.id))
        .where(
          and(
            inArray(membershipRole.membershipId, membershipIds),
            eq(role.scope, "organization"),
            or(eq(role.isProtected, true), eq(role.organizationId, organizationId))
          )
        )
    : [];
  const rolesByMembership = new Map<string, Array<{ id: string; name: string }>>();
  for (const roleResult of roleResults) {
    const roles = rolesByMembership.get(roleResult.membershipId) ?? [];
    roles.push({ id: roleResult.roleId, name: roleResult.roleName });
    rolesByMembership.set(roleResult.membershipId, roles);
  }
  return {
    total,
    page,
    pageSize,
    rows: results.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      email: row.email,
      username: row.username,
      status: row.status as "active" | "suspended",
      createdAt: row.createdAt,
      activationState: row.invitedAt ? "pending" : "activated",
      ...(includeIdentityDisabled ? { identityDisabled: Boolean(row.disabledAt) } : {}),
      roles: rolesByMembership.get(row.id) ?? [],
    })),
  };
}

export async function getOrganizationMemberPermissions(userId: string, organizationId: string) {
  const rows = await db
    .select({ permissionKey: permission.key })
    .from(member)
    .innerJoin(membershipRole, eq(member.id, membershipRole.membershipId))
    .innerJoin(role, eq(membershipRole.roleId, role.id))
    .innerJoin(rolePermission, eq(role.id, rolePermission.roleId))
    .innerJoin(permission, eq(rolePermission.permissionKey, permission.key))
    .where(
      and(
        eq(member.userId, userId),
        eq(member.organizationId, organizationId),
        eq(member.status, "active"),
        eq(role.scope, "organization"),
        or(eq(role.isProtected, true), eq(role.organizationId, organizationId)),
        eq(permission.scope, "organization")
      )
    );
  const granted = new Set(rows.map(({ permissionKey }) => permissionKey));
  return {
    canRead: granted.has(PERMISSIONS.ORGANIZATION_MEMBERS_READ),
    canProvision: granted.has(PERMISSIONS.ORGANIZATION_MEMBERS_PROVISION),
    canCreateRestriction: granted.has(PERMISSIONS.ORGANIZATION_RESTRICTIONS_CREATE),
    canManageAccess: granted.has(PERMISSIONS.ORGANIZATION_MEMBER_ACCESS_UPDATE),
    canTransferOwnership: granted.has(PERMISSIONS.ORGANIZATION_OWNERSHIP_TRANSFER),
    canRemoveMembers: granted.has(PERMISSIONS.ORGANIZATION_MEMBERS_REMOVE),
  };
}
