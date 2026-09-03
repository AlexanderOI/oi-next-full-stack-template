import { z } from "zod";

import { permissionKeySchema } from "./permission-key-schema";

export const roleInputSchema = z.object({
  id: z.string().min(1, "ROLE_ID_REQUIRED").optional(),
  name: z.string().trim().min(2, "ROLE_NAME_MIN").max(80, "ROLE_NAME_MAX"),
  description: z.string().trim().max(240, "DESCRIPTION_MAX"),
  permissions: z.array(permissionKeySchema).min(1, "PERMISSION_REQUIRED"),
});

export type RoleInput = z.infer<typeof roleInputSchema>;
