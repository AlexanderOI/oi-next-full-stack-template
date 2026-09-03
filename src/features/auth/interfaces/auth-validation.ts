export type AuthValidationKey =
  | "identifierRequired"
  | "passwordMin"
  | "nameMin"
  | "emailInvalid"
  | "usernameMin"
  | "usernameMax"
  | "usernameFormat"
  | "passwordsMismatch";

export type TranslateValidation = (key: AuthValidationKey) => string;
