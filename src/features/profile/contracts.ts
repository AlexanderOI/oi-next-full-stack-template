import { z } from "zod";

export interface ProfileUser {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  locale: "en" | "es" | null;
}

export interface ProfileInput {
  name: string;
  username: string;
  email: string;
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type ProfileErrorCode =
  | "VALIDATION_ERROR"
  | "USERNAME_TAKEN"
  | "UPDATE_FAILED"
  | "EMAIL_VERIFICATION_FAILED"
  | "PASSWORD_CHANGE_FAILED"
  | "AVATAR_INVALID_TYPE"
  | "AVATAR_TOO_LARGE"
  | "AVATAR_UPDATE_FAILED";

type ValidationKey =
  | "nameMin"
  | "usernameMin"
  | "usernameMax"
  | "usernameFormat"
  | "emailInvalid"
  | "currentPasswordRequired"
  | "passwordMin"
  | "confirmPasswordRequired"
  | "passwordsMismatch";
type TranslateValidation = (key: ValidationKey) => string;

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
