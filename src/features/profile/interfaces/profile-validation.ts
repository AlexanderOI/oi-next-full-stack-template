export type ProfileValidationKey =
  | "nameMin"
  | "usernameMin"
  | "usernameMax"
  | "usernameFormat"
  | "emailInvalid"
  | "currentPasswordRequired"
  | "passwordMin"
  | "confirmPasswordRequired"
  | "passwordsMismatch";

export type TranslateValidation = (key: ProfileValidationKey) => string;
