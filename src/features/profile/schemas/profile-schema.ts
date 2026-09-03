import { z } from "zod";

import type { TranslateValidation } from "../interfaces/profile-validation";

export function createProfileSchema(t: TranslateValidation) {
  return z.object({
    name: z.string().trim().min(2, t("nameMin")),
    username: z
      .string()
      .trim()
      .min(3, t("usernameMin"))
      .max(30, t("usernameMax"))
      .regex(/^[a-z0-9.]+$/, t("usernameFormat")),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email(t("emailInvalid"))),
  });
}

export type ProfileInput = z.infer<ReturnType<typeof createProfileSchema>>;
