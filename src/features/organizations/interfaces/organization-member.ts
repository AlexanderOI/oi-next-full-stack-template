export interface OrganizationMemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  username: string | null;
  status: "active" | "suspended";
  createdAt: Date;
  activationState: "pending" | "activated";
  identityDisabled?: boolean;
  roles: Array<{ id: string; name: string }>;
}

export interface OrganizationMemberPage {
  rows: OrganizationMemberRow[];
  total: number;
  page: number;
  pageSize: number;
}
