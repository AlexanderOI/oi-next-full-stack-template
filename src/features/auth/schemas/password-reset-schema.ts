import { z } from "zod";

import type { TranslateValidation } from "../interfaces/auth-validation";

export function createPasswordResetSchema(t: TranslateValidation) {
  return z
    .object({
      newPassword: z.string().min(8, t("passwordMin")),
      confirmPassword: z.string().min(1, t("confirmPasswordRequired")),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("passwordsMismatch"),
      path: ["confirmPassword"],
    });
}

export type PasswordResetInput = z.infer<ReturnType<typeof createPasswordResetSchema>>;
