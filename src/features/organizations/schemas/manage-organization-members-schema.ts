import { z } from "zod";

export const manageOrganizationMemberSchema = z.object({
  memberId: z.string().trim().min(1),
  status: z.enum(["active", "suspended"]),
});

export const removeOrganizationMemberSchema = z.object({
  memberId: z.string().trim().min(1),
});

export const transferOrganizationOwnershipSchema = z.object({
  recipientMemberId: z.string().trim().min(1),
});

export type ManageOrganizationMemberInput = z.infer<typeof manageOrganizationMemberSchema>;
export type TransferOrganizationOwnershipInput = z.infer<
  typeof transferOrganizationOwnershipSchema
>;
