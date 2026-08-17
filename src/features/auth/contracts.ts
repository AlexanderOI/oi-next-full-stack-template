import { z } from "zod";

export { accountVerificationEmail, emailChangeVerificationEmail } from "./email/verification-email";

type AuthValidationKey =
  | "identifierRequired"
  | "passwordMin"
  | "nameMin"
  | "emailInvalid"
  | "usernameMin"
  | "usernameMax"
  | "usernameFormat"
  | "passwordsMismatch";
type TranslateValidation = (key: AuthValidationKey) => string;

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export function createLoginSchema(t: TranslateValidation) {
  return z.object({
    identifier: z.string().min(1, t("identifierRequired")),
    password: z.string().min(8, t("passwordMin")),
  });
}

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
