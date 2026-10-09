export interface OrganizationSessionContext {
  user: { id: string };
  session: { id: string; activeOrganizationId?: string | null };
}
