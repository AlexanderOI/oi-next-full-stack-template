import { z } from "zod";

const normalizedEmailSchema = z.string().trim().toLowerCase().pipe(z.email("EMAIL_INVALID"));

export const createOrganizationInvitationSchema = z.object({
  email: normalizedEmailSchema,
  roleId: z.string().trim().min(1),
});

export const organizationInvitationIdSchema = z.object({
  invitationId: z.string().trim().min(1),
});

export type CreateOrganizationInvitationInput = z.infer<typeof createOrganizationInvitationSchema>;
export type OrganizationInvitationIdInput = z.infer<typeof organizationInvitationIdSchema>;
