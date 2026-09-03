import { z } from "zod";

export const userRolesInputSchema = z.object({
  userId: z.string().min(1, "USER_ID_REQUIRED"),
  roleIds: z.array(z.string().min(1, "ROLE_ID_REQUIRED")).min(1, "ROLE_REQUIRED"),
});

export type UserRolesInput = z.infer<typeof userRolesInputSchema>;
