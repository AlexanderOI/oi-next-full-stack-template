export type AuthValidationKey =
  | "identifierRequired"
  | "passwordMin"
  | "confirmPasswordRequired"
  | "nameMin"
  | "emailInvalid"
  | "usernameMin"
  | "usernameMax"
  | "usernameFormat"
  | "passwordsMismatch";

export type TranslateValidation = (key: AuthValidationKey) => string;
