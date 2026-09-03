import { z } from "zod";

import type { TranslateValidation } from "../interfaces/profile-validation";

export function createPasswordChangeSchema(t: TranslateValidation) {
  return z
    .object({
      currentPassword: z.string().min(1, t("currentPasswordRequired")),
      newPassword: z.string().min(8, t("passwordMin")),
      confirmPassword: z.string().min(1, t("confirmPasswordRequired")),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("passwordsMismatch"),
      path: ["confirmPassword"],
    });
}

export type PasswordChangeInput = z.infer<ReturnType<typeof createPasswordChangeSchema>>;
