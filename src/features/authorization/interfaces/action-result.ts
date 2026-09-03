import type { AuthorizationErrorCode } from "./authorization-error-code";

export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; code: AuthorizationErrorCode; details?: Record<string, string[]> };
