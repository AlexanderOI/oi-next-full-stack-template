export const PERMISSIONS = {
  PROFILE_READ_OWN: "profile.read.own",
  PROFILE_UPDATE_OWN: "profile.update.own",
  ROLES_READ: "authorization.roles.read",
  ROLES_CREATE: "authorization.roles.create",
  ROLES_UPDATE: "authorization.roles.update",
  ROLES_DELETE: "authorization.roles.delete",
  USERS_READ: "authorization.users.read",
  USERS_INVITE: "authorization.users.invite",
  USER_ACCESS_UPDATE: "authorization.user-access.update",
  USER_ROLES_UPDATE: "authorization.user-roles.update",
  AUDIT_READ: "authorization.audit.read",
} as const;
