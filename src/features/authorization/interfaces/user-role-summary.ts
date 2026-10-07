export interface UserRoleSummary {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  username: string | null;
  invitedAt: Date | null;
  disabledAt: Date | null;
  roleIds: readonly string[];
}
