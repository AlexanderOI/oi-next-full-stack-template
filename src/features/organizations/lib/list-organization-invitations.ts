import "server-only";

import { and, asc, count, desc, eq, gt, ilike, isNull, lte, or } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { invitation, member, membershipRole, permission, role, rolePermission } from "@/db/schema";
import { PERMISSIONS } from "@/features/authorization/server";
import type {
  OrganizationInvitationEffectiveStatus,
  OrganizationInvitationPage,
  OrganizationInvitationPermissions,
} from "../interfaces/organization-invitation-admin";

const maxPageSize = 100;
const statuses = ["pending", "accepted", "rejected", "canceled"] as const;
type InvitationFilter = (typeof statuses)[number] | "expired" | "all";

export interface ListOrganizationInvitationsInput {
  organizationId: string;
  page: number;
  pageSize: number;
  search: string;
  status: string;
  sort: string;
  direction: "asc" | "desc";
  now?: Date;
}

function effectiveStatus(
  status: string,
  expiresAt: Date,
  now: Date
): OrganizationInvitationEffectiveStatus {
  if (status === "pending" && expiresAt.getTime() <= now.getTime()) return "expired";
  if (status === "accepted" || status === "rejected" || status === "canceled") return status;
  return "pending";
}

function statusCondition(filter: InvitationFilter, now: Date) {
  if (filter === "all") return undefined;
  if (filter === "expired") {
    return and(eq(invitation.status, "pending"), lte(invitation.expiresAt, now));
  }
  if (filter === "pending") {
    return and(eq(invitation.status, "pending"), gt(invitation.expiresAt, now));
  }
  return eq(invitation.status, filter);
}

export async function listOrganizationInvitations({
  organizationId,
  page: requestedPage,
  pageSize: requestedPageSize,
  search,
  status: requestedStatus,
  sort,
  direction,
  now = new Date(),
}: ListOrganizationInvitationsInput): Promise<OrganizationInvitationPage> {
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number.isSafeInteger(requestedPageSize) ? requestedPageSize : 20)
  );
  const filter: InvitationFilter = [...statuses, "expired", "all"].includes(
    requestedStatus as InvitationFilter
  )
    ? (requestedStatus as InvitationFilter)
    : "all";
  const term = search.trim().slice(0, 100);
  const searchCondition = term ? ilike(invitation.email, `%${term}%`) : undefined;
  const conditions = [
    eq(invitation.organizationId, organizationId),
    statusCondition(filter, now),
    searchCondition,
  ].filter(Boolean);
  const where = and(...conditions);
  const [countResult] = await db.select({ total: count() }).from(invitation).where(where);
  const total = Number(countResult?.total ?? 0);

  const sortableColumns = {
    email: invitation.email,
    status: invitation.status,
    effectiveStatus: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    role: role.name,
  } as const;
  const sortColumn = sortableColumns[sort as keyof typeof sortableColumns] ?? invitation.createdAt;
  const rows = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      roleId: invitation.role,
      roleName: role.name,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })
    .from(invitation)
    .innerJoin(role, eq(invitation.role, role.id))
    .where(where)
    .orderBy(direction === "desc" ? desc(sortColumn) : asc(sortColumn), asc(invitation.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const roleOptions = await db
    .select({ id: role.id, key: role.key, name: role.name, isProtected: role.isProtected })
    .from(role)
    .where(
      and(
        eq(role.scope, "organization"),
        or(
          and(eq(role.isProtected, true), isNull(role.organizationId)),
          and(eq(role.isProtected, false), eq(role.organizationId, organizationId))
        )
      )
    )
    .orderBy(asc(role.name), asc(role.id));

  return {
    total,
    page,
    pageSize,
    rows: rows.map((row) => ({
      ...row,
      effectiveStatus: effectiveStatus(row.status, row.expiresAt, now),
    })),
    roles: roleOptions,
  };
}

export async function getOrganizationInvitationPermissions(
  userId: string,
  organizationId: string
): Promise<OrganizationInvitationPermissions> {
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
  const canCreate = granted.has(PERMISSIONS.ORGANIZATION_INVITATIONS_CREATE);
  const canUpdateMemberRoles = granted.has(PERMISSIONS.ORGANIZATION_MEMBER_ROLES_UPDATE);
  return {
    canRead: granted.has(PERMISSIONS.ORGANIZATION_INVITATIONS_READ),
    canCreate: canCreate && canUpdateMemberRoles,
    canResend:
      canCreate && canUpdateMemberRoles && granted.has(PERMISSIONS.ORGANIZATION_INVITATIONS_RESEND),
    canCancel: granted.has(PERMISSIONS.ORGANIZATION_INVITATIONS_CANCEL),
    canUpdateMemberRoles,
    canTransferOwnership: granted.has(PERMISSIONS.ORGANIZATION_OWNERSHIP_TRANSFER),
  };
}
