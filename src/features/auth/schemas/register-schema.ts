import { z } from "zod";

import type { TranslateValidation } from "../interfaces/auth-validation";

export function createRegisterSchema(t: TranslateValidation) {
  const usernameSchema = z
    .string()
    .min(3, t("usernameMin"))
    .max(30, t("usernameMax"))
    .regex(/^[a-z0-9.]+$/, t("usernameFormat"));

  return z
    .object({
      name: z.string().min(2, t("nameMin")),
      email: z.email(t("emailInvalid")),
      username: usernameSchema,
      password: z.string().min(8, t("passwordMin")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("passwordsMismatch"),
      path: ["confirmPassword"],
    });
}

export type RegisterInput = z.infer<ReturnType<typeof createRegisterSchema>>;
