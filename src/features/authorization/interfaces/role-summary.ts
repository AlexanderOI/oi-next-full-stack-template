import type { PermissionKey } from "./permission";

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: readonly PermissionKey[];
}
