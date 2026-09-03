import type { RoleSummary } from "../interfaces/role-summary";

export function localizeSystemRoles(
  roles: readonly RoleSummary[],
  t: (key: "admin.name" | "admin.description" | "member.name" | "member.description") => string
): RoleSummary[] {
  return roles.map((role) => {
    if (!role.isSystem || (role.key !== "admin" && role.key !== "member")) return role;
    return {
      ...role,
      name: t(`${role.key}.name`),
      description: t(`${role.key}.description`),
    };
  });
}
