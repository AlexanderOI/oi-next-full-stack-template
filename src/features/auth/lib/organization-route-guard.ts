import { APIError } from "better-auth/api";

export async function organizationRouteGuard(context: { path: string }) {
  if (context.path === "/organization" || context.path.startsWith("/organization/")) {
    throw new APIError("FORBIDDEN", {
      message: "ORGANIZATION_ENDPOINTS_UNAVAILABLE",
    });
  }
}
