import { z } from "zod";

export const userAccessInputSchema = z.object({
  userId: z.string().min(1, "USER_ID_REQUIRED"),
  status: z.enum(["active", "disabled"]),
});

export type UserAccessInput = z.infer<typeof userAccessInputSchema>;
