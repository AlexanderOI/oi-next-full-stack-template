import { memoryAdapter } from "@better-auth/memory-adapter";
import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { organization } from "better-auth/plugins";
import { describe, expect, it } from "vitest";

import { organizationRouteGuard } from "@/features/auth/lib/organization-route-guard";

const auth = betterAuth({
  baseURL: "http://localhost",
  database: memoryAdapter({
    user: [],
    session: [],
    account: [],
    verification: [],
    organization: [],
    member: [],
    invitation: [],
  }),
  disabledPaths: ["/organization/accept-invitation", "/organization/delete"],
  hooks: { before: createAuthMiddleware(organizationRouteGuard) },
  plugins: [organization({ disableOrganizationDeletion: true })],
  secret: "test-secret-that-is-long-enough-for-better-auth",
});

const blockedOrganizationRequests = [
  { method: "GET", path: "/organization/list", expectedStatus: 403 },
  { method: "POST", path: "/organization/create", expectedStatus: 403 },
  { method: "POST", path: "/organization/set-active", expectedStatus: 403 },
  { method: "POST", path: "/organization/accept-invitation", expectedStatus: 404 },
  { method: "POST", path: "/organization/delete", expectedStatus: 404 },
  { method: "GET", path: "/organization/list-user-invitations", expectedStatus: 403 },
] as const;

describe("Better Auth organization route guard dispatch integration", () => {
  it.each(blockedOrganizationRequests)(
    "denies HTTP $method $path",
    async ({ method, path, expectedStatus }) => {
      const response = await auth.handler(
        new Request(`http://localhost/api/auth${path}`, {
          method,
          headers: { "content-type": "application/json" },
          ...(method === "POST" ? { body: "{}" } : {}),
        })
      );

      expect(response.status).toBe(expectedStatus);
      if (expectedStatus === 403) {
        expect(await response.json()).toMatchObject({
          message: "ORGANIZATION_ENDPOINTS_UNAVAILABLE",
        });
      }
    }
  );

  it("denies direct auth.api reads and acceptance/deletion mutations with the same guard", async () => {
    const headers = new Headers();
    const directInvocations = [
      () => auth.api.listOrganizations({ headers }),
      () => auth.api.setActiveOrganization({ headers, body: { organizationId: "organization-1" } }),
      () => auth.api.listUserInvitations({ headers }),
      () => auth.api.acceptInvitation({ headers, body: { invitationId: "invitation-1" } }),
      () => auth.api.deleteOrganization({ headers, body: { organizationId: "organization-1" } }),
    ];

    for (const invoke of directInvocations) {
      await expect(invoke()).rejects.toMatchObject({
        body: { message: "ORGANIZATION_ENDPOINTS_UNAVAILABLE" },
        status: "FORBIDDEN",
      });
    }
  });

  it("keeps unrelated authentication endpoints available", async () => {
    const response = await auth.handler(new Request("http://localhost/api/auth/ok"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });
});
