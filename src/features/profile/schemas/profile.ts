import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-z0-9.]+$/, "Username can only contain lowercase letters, numbers, and dots"),
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email address")),
});

export type ProfileSchemaType = z.infer<typeof profileSchema>;
