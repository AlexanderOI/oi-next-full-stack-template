export type OrganizationInvitationEffectiveStatus =
  "pending" | "expired" | "accepted" | "rejected" | "canceled";

export interface OrganizationInvitationAdminRow {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  status: string;
  effectiveStatus: OrganizationInvitationEffectiveStatus;
  expiresAt: Date;
  createdAt: Date;
}

export interface OrganizationInvitationRoleOption {
  id: string;
  key: string;
  name: string;
  isProtected: boolean;
}

export interface OrganizationInvitationPage {
  rows: OrganizationInvitationAdminRow[];
  roles: OrganizationInvitationRoleOption[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrganizationInvitationPermissions {
  canRead: boolean;
  canCreate: boolean;
  canResend: boolean;
  canCancel: boolean;
  canUpdateMemberRoles: boolean;
  canTransferOwnership: boolean;
}
