import { z } from "zod";

import type { TranslateValidation } from "../interfaces/auth-validation";

export function createLoginSchema(t: TranslateValidation) {
  return z.object({
    identifier: z.string().min(1, t("identifierRequired")),
    password: z.string().min(8, t("passwordMin")),
  });
}

export type LoginInput = z.infer<ReturnType<typeof createLoginSchema>>;
