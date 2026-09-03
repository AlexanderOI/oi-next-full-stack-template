export interface UserRoleSummary {
  id: string;
  name: string;
  email: string;
  username: string | null;
  roleIds: readonly string[];
}
