import { z } from "zod";

import type { TranslateValidation } from "../interfaces/auth-validation";

export function createPasswordResetRequestSchema(t: TranslateValidation) {
  return z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email(t("emailInvalid"))),
  });
}

export type PasswordResetRequestInput = z.infer<
  ReturnType<typeof createPasswordResetRequestSchema>
>;
