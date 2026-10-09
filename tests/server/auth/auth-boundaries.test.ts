import { beforeEach, describe, expect, it, vi } from "vitest";

interface AuthConfiguration {
  emailAndPassword: {
    enabled: boolean;
    requireEmailVerification: boolean;
    sendResetPassword: (
      input: { user: { id: string; name: string; email: string }; url: string; token: string },
      request: Request
    ) => Promise<void>;
    onPasswordReset: (input: { user: { id: string } }, request?: Request) => Promise<void>;
  };
  emailVerification: {
    sendOnSignUp: boolean;
    sendVerificationEmail: (
      input: { user: { id: string; name: string; email: string }; url: string },
      request: Request
    ) => Promise<void>;
  };
  databaseHooks: {
    user: {
      create: {
        after: (
          user: { id: string; name: string; email: string; username: string },
          context?: { request?: Request } | null
        ) => Promise<void>;
      };
    };
    session: {
      create: {
        before: (session: { userId: string }) => Promise<boolean | void | { data: object }>;
      };
    };
  };
  user: {
    additionalFields: Record<string, { type: string; required: boolean; input: boolean }>;
  };
  plugins: unknown[];
  hooks: { before: (context: { path: string }) => Promise<unknown> };
  disabledPaths: string[];
}

const mocks = vi.hoisted(() => ({
  authConfig: undefined as AuthConfiguration | undefined,
  betterAuth: vi.fn(),
  createAuthMiddleware: vi.fn((handler: (context: { path: string }) => Promise<void>) => handler),
  organization: vi.fn<(options: Record<string, unknown>) => string>(),
  organizationOptions: undefined as Record<string, unknown> | undefined,
  dbFrom: vi.fn(),
  dbInsert: vi.fn(),
  dbLimit: vi.fn(),
  dbSelect: vi.fn(),
  dbValues: vi.fn(),
  dbWhere: vi.fn(),
  getSession: vi.fn(),
  requestPasswordReset: vi.fn(),
  headers: vi.fn(),
  onConflictDoNothing: vi.fn(),
  sendLocalizedVerificationEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
  completePublicSignup: vi.fn(),
  compensateFailedPublicSignup: vi.fn(),
  compensateFailedTrustedSignup: vi.fn(),
  sendLocalizedPasswordResetEmail: vi.fn(),
  dbDelete: vi.fn(),
  dbDeleteWhere: vi.fn(),
  dbUpdate: vi.fn(),
  dbSet: vi.fn(),
  dbReturning: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => ({ and: conditions })),
  eq: vi.fn((column, value) => ({ column, value })),
  isNotNull: vi.fn((column) => ({ isNotNull: column })),
}));
vi.mock("@better-auth/drizzle-adapter", () => ({ drizzleAdapter: vi.fn(() => "db-adapter") }));
vi.mock("better-auth/next-js", () => ({ nextCookies: vi.fn(() => "next-cookies") }));
vi.mock("better-auth/plugins", () => ({
  username: vi.fn(() => "username-plugin"),
  organization: mocks.organization.mockImplementation((options) => {
    mocks.organizationOptions = options;
    return "organization-plugin";
  }),
}));
vi.mock("@/db/schema", () => ({
  role: {
    id: "role.id",
    key: "role.key",
    scope: "role.scope",
    isProtected: "role.isProtected",
  },
  schema: {},
  platformRoleAssignment: "platform-role-assignment-table",
  member: {
    id: "member.id",
    organizationId: "member.organizationId",
    userId: "member.userId",
    role: "member.role",
    status: "member.status",
  },
  session: {
    id: "session.id",
    userId: "session.userId",
    activeOrganizationId: "session.activeOrganizationId",
  },
  account: { userId: "account.userId" },
  user: {
    id: "user.id",
    initialActiveOrganizationId: "user.initialActiveOrganizationId",
    emailVerified: "user.emailVerified",
    invitedAt: "user.invitedAt",
    disabledAt: "user.disabledAt",
  },
}));
vi.mock("@/db/drizzle", () => ({
  db: {
    select: mocks.dbSelect,
    insert: mocks.dbInsert,
    update: mocks.dbUpdate,
    delete: mocks.dbDelete,
  },
}));
vi.mock("@/features/organizations/server", () => ({
  completePublicSignup: mocks.completePublicSignup,
  compensateFailedPublicSignup: mocks.compensateFailedPublicSignup,
  compensateFailedTrustedSignup: mocks.compensateFailedTrustedSignup,
}));
vi.mock("@/features/auth/email/verification-email-delivery", () => ({
  sendLocalizedVerificationEmail: mocks.sendLocalizedVerificationEmail,
}));
vi.mock("@/features/auth/email/password-reset-email-delivery", () => ({
  sendLocalizedPasswordResetEmail: mocks.sendLocalizedPasswordResetEmail,
}));
vi.mock("better-auth/api", () => ({
  APIError: class APIError extends Error {
    constructor(_code: string, options: { message: string }) {
      super(options.message);
    }
  },
  createAuthMiddleware: mocks.createAuthMiddleware,
}));
vi.mock("better-auth", () => ({
  betterAuth: mocks.betterAuth.mockImplementation((config) => {
    mocks.authConfig = config;
    return {
      api: {
        getSession: mocks.getSession,
        requestPasswordReset: mocks.requestPasswordReset,
        sendVerificationEmail: mocks.sendVerificationEmail,
      },
      $Infer: {},
    };
  }),
}));

import {
  getCurrentSession,
  requestInvitationPasswordReset,
  requireSession,
} from "@/features/auth/server";
import {
  AUTH_NONRESTRICTIVE_INVITATION_LIMIT,
  AUTH_NONRESTRICTIVE_MEMBERSHIP_LIMIT,
  MAX_ACTIVE_MEMBERS_PER_ORGANIZATION,
  MAX_ORGANIZATIONS_PER_USER,
  ORGANIZATION_INVITATION_LIFETIME_DAYS,
} from "@/features/organizations/contracts";
import { organizationRouteGuard } from "@/features/auth/lib/organization-route-guard";

describe("authentication server boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dbLimit.mockReset();
    mocks.dbLimit.mockResolvedValue([]);
    mocks.headers.mockResolvedValue(new Headers({ cookie: "session=valid" }));
    mocks.dbSelect.mockReturnValue({ from: mocks.dbFrom });
    mocks.dbFrom.mockReturnValue({ where: mocks.dbWhere });
    mocks.dbWhere.mockReturnValue({ limit: mocks.dbLimit });
    mocks.dbInsert.mockReturnValue({ values: mocks.dbValues });
    mocks.dbValues.mockReturnValue({ onConflictDoNothing: mocks.onConflictDoNothing });
    mocks.dbUpdate.mockReturnValue({ set: mocks.dbSet });
    mocks.dbDelete.mockReturnValue({ where: mocks.dbDeleteWhere });
    mocks.dbDeleteWhere.mockResolvedValue(undefined);
    mocks.dbSet.mockReturnValue({ where: mocks.dbReturning });
    mocks.dbReturning.mockResolvedValue(undefined);
    mocks.onConflictDoNothing.mockResolvedValue(undefined);
    mocks.sendLocalizedVerificationEmail.mockResolvedValue(undefined);
    mocks.sendVerificationEmail.mockResolvedValue({ status: true });
    mocks.completePublicSignup.mockResolvedValue(undefined);
    mocks.compensateFailedPublicSignup.mockResolvedValue(undefined);
    mocks.compensateFailedTrustedSignup.mockResolvedValue(undefined);
    mocks.sendLocalizedPasswordResetEmail.mockResolvedValue(undefined);
    mocks.requestPasswordReset.mockImplementation(async ({ request }) => {
      try {
        await mocks.authConfig?.emailAndPassword.sendResetPassword(
          {
            user: { id: "user-1", name: "Alex", email: "alex@example.com" },
            url: "https://example.com/api/auth/reset-password/invitation-token",
            token: "invitation-token",
          },
          request
        );
      } catch {
        // Better Auth 1.6.25 swallows callback failures and still resolves successfully.
      }

      return { status: true, message: "sent" };
    });
  });

  it("delegates password-reset email delivery without handling the token itself", async () => {
    const request = new Request("https://example.com/api/auth/request-password-reset");
    const user = { id: "user-1", name: "Alex", email: "alex@example.com" };

    await mocks.authConfig?.emailAndPassword.sendResetPassword(
      { user, url: "https://example.com/api/auth/reset-password/secret", token: "secret" },
      request
    );

    expect(mocks.sendLocalizedPasswordResetEmail).toHaveBeenCalledWith(
      user,
      "https://example.com/api/auth/reset-password/secret",
      request
    );
  });

  it("rejects an invitation when Better Auth resolves after swallowing delivery failure", async () => {
    mocks.sendLocalizedPasswordResetEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));

    await expect(
      requestInvitationPasswordReset("alex@example.com", "/auth/reset-password")
    ).rejects.toThrow("INVITATION_DELIVERY_FAILED");

    expect(mocks.requestPasswordReset).toHaveBeenCalledOnce();
  });

  it("accepts an invitation only after its delivery callback reports success", async () => {
    await expect(
      requestInvitationPasswordReset("alex@example.com", "/auth/reset-password")
    ).resolves.toBeUndefined();
  });

  it("waits for a deferred callback and rejects its swallowed delivery failure", async () => {
    vi.useFakeTimers();
    mocks.sendLocalizedPasswordResetEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));
    mocks.requestPasswordReset.mockImplementationOnce(async ({ request }) => {
      setTimeout(async () => {
        try {
          await mocks.authConfig?.emailAndPassword.sendResetPassword(
            {
              user: { id: "user-1", name: "Alex", email: "alex@example.com" },
              url: "https://example.com/api/auth/reset-password/invitation-token",
              token: "invitation-token",
            },
            request
          );
        } catch {
          // Models Better Auth waitUntil work swallowing the callback rejection.
        }
      }, 25);

      return { status: true, message: "sent" };
    });

    const result = expect(
      requestInvitationPasswordReset("alex@example.com", "/auth/reset-password")
    ).rejects.toThrow("INVITATION_DELIVERY_FAILED");
    await vi.runAllTimersAsync();

    await result;
    vi.useRealTimers();
  });

  it("rejects an invitation when Better Auth never invokes the delivery callback", async () => {
    vi.useFakeTimers();
    mocks.requestPasswordReset.mockResolvedValueOnce({ status: true, message: "sent" });

    const result = expect(
      requestInvitationPasswordReset("alex@example.com", "/auth/reset-password")
    ).rejects.toThrow("INVITATION_DELIVERY_FAILED");
    await vi.runAllTimersAsync();

    await result;
    vi.useRealTimers();
  });

  it("requires email verification but defers signup delivery until onboarding is ready", async () => {
    expect(mocks.authConfig).toMatchObject({
      emailAndPassword: { enabled: true, requireEmailVerification: true },
      emailVerification: { sendOnSignUp: false },
    });

    const request = new Request("https://example.com/api/auth/sign-up/email");
    const user = { id: "user-1", name: "Alex", email: "alex@example.com" };
    await mocks.authConfig?.emailVerification.sendVerificationEmail(
      { user, url: "https://example.com/verify?token=one" },
      request
    );

    expect(mocks.sendLocalizedVerificationEmail).toHaveBeenCalledWith(
      user,
      "https://example.com/verify?token=one",
      request
    );
  });

  it("suppresses ordinary verification only for a module-trusted invitation request", async () => {
    const { createTrustedInvitationRequest } =
      await import("@/features/auth/lib/invitation-capability");
    const user = { id: "user-1", name: "Alex", email: "alex@example.com" };

    await mocks.authConfig?.emailVerification.sendVerificationEmail(
      { user, url: "https://example.com/verify?token=invitation" },
      createTrustedInvitationRequest("https://example.com/api/auth/sign-up/email")
    );

    expect(mocks.sendLocalizedVerificationEmail).not.toHaveBeenCalled();

    await mocks.authConfig?.emailVerification.sendVerificationEmail(
      { user, url: "https://example.com/verify?token=public" },
      new Request("https://example.com/api/auth/sign-up/email", {
        headers: { "x-oi-nextjs-invitation-capability": "public-guess" },
      })
    );
    expect(mocks.sendLocalizedVerificationEmail).toHaveBeenCalledOnce();
  });

  it("marks only pending invited accounts verified after Better Auth resets their password", async () => {
    await mocks.authConfig?.emailAndPassword.onPasswordReset({ user: { id: "user-1" } });

    expect(mocks.dbSet).toHaveBeenCalledWith({ emailVerified: true, invitedAt: null });
    expect(mocks.dbReturning).toHaveBeenCalledWith(
      expect.objectContaining({ and: expect.any(Array) })
    );
  });

  it("keeps signup provenance private in Better Auth's organization schema", () => {
    expect(mocks.organizationOptions?.schema).toMatchObject({
      organization: {
        additionalFields: {
          personalSignupOwnerUserId: {
            type: "string",
            required: false,
            input: false,
            returned: false,
          },
        },
      },
    });
  });

  it("exposes server-controlled user lifecycle timestamps to Better Auth", () => {
    expect(mocks.authConfig?.user.additionalFields).toMatchObject({
      invitedAt: { type: "date", required: false, input: false },
      disabledAt: { type: "date", required: false, input: false },
      initialActiveOrganizationId: {
        type: "string",
        required: false,
        input: false,
        returned: false,
      },
    });
  });

  it("rejects session creation for disabled users without the Better Auth admin plugin", async () => {
    mocks.dbLimit.mockResolvedValueOnce([{ disabledAt: new Date() }]);

    await expect(
      mocks.authConfig?.databaseHooks.session.create.before({ userId: "disabled-user" })
    ).resolves.toBe(false);
    expect(mocks.authConfig?.plugins).toEqual([
      "next-cookies",
      "username-plugin",
      "organization-plugin",
    ]);
  });

  it("configures Better Auth organization limits and disables stock deletion and mutation paths", async () => {
    expect(mocks.organizationOptions).toMatchObject({
      organizationLimit: MAX_ORGANIZATIONS_PER_USER,
      invitationExpiresIn: ORGANIZATION_INVITATION_LIFETIME_DAYS * 24 * 60 * 60,
      membershipLimit: AUTH_NONRESTRICTIVE_MEMBERSHIP_LIMIT,
      invitationLimit: AUTH_NONRESTRICTIVE_INVITATION_LIMIT,
      disableOrganizationDeletion: true,
    });
    expect(mocks.organizationOptions?.membershipLimit).not.toBe(
      MAX_ACTIVE_MEMBERS_PER_ORGANIZATION
    );
    expect(mocks.authConfig?.hooks.before).toBe(organizationRouteGuard);
    expect(mocks.authConfig?.disabledPaths).toEqual([
      "/organization/accept-invitation",
      "/organization/delete",
    ]);
  });

  it.each([
    "/organization/list",
    "/organization/create",
    "/organization/accept-invitation",
    "/organization/delete",
    "/organization/list-user-invitations",
  ])("blocks Better Auth organization endpoint %s until product handlers exist", async (path) => {
    await expect(mocks.authConfig?.hooks.before({ path })).rejects.toThrow(
      "ORGANIZATION_ENDPOINTS_UNAVAILABLE"
    );
  });

  it("does not block unrelated Better Auth endpoints", async () => {
    await expect(
      mocks.authConfig?.hooks.before({ path: "/sign-in/email" })
    ).resolves.toBeUndefined();
  });

  it("sets the initial organization only for a verified active membership", async () => {
    mocks.dbLimit
      .mockResolvedValueOnce([{ disabledAt: null }])
      .mockResolvedValueOnce([{ initialActiveOrganizationId: "org-1", emailVerified: true }])
      .mockResolvedValueOnce([{ id: "membership-1" }]);

    await expect(
      mocks.authConfig?.databaseHooks.session.create.before({ userId: "user-1" })
    ).resolves.toEqual({ data: { activeOrganizationId: "org-1" } });
    expect(mocks.dbUpdate).not.toHaveBeenCalled();
  });

  it("does not set initial context before email verification", async () => {
    mocks.dbLimit
      .mockResolvedValueOnce([{ disabledAt: null }])
      .mockResolvedValueOnce([{ initialActiveOrganizationId: "org-1", emailVerified: false }]);

    await expect(
      mocks.authConfig?.databaseHooks.session.create.before({ userId: "user-1" })
    ).resolves.toBeUndefined();
  });

  it("does not set initial context when its membership is not active", async () => {
    mocks.dbLimit
      .mockResolvedValueOnce([{ disabledAt: null }])
      .mockResolvedValueOnce([{ initialActiveOrganizationId: "org-1", emailVerified: true }])
      .mockResolvedValueOnce([]);

    await expect(
      mocks.authConfig?.databaseHooks.session.create.before({ userId: "user-1" })
    ).resolves.toBeUndefined();
  });

  it("does not auto-select an organization for sessions created after the marker is absent", async () => {
    mocks.dbLimit
      .mockResolvedValueOnce([{ disabledAt: null }])
      .mockResolvedValueOnce([{ initialActiveOrganizationId: null, emailVerified: true }]);

    await expect(
      mocks.authConfig?.databaseHooks.session.create.before({ userId: "user-1" })
    ).resolves.toBeUndefined();
  });

  it("leaves ordinary active session creation unchanged", async () => {
    mocks.dbLimit.mockResolvedValueOnce([{ disabledAt: null }]);

    await expect(
      mocks.authConfig?.databaseHooks.session.create.before({ userId: "active-user" })
    ).resolves.toBeUndefined();
  });

  it("onboards public signups before sending the verification request", async () => {
    const request = new Request("https://example.com/api/auth/sign-up/email");
    mocks.dbLimit.mockResolvedValueOnce([{ id: "role-member" }]);

    await mocks.authConfig?.databaseHooks.user.create.after(
      {
        id: "user-1",
        name: "Alex",
        email: "alex@example.com",
        username: "alex",
      },
      { request }
    );

    expect(mocks.completePublicSignup).toHaveBeenCalledWith("user-1", "alex", "Alex");
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
      body: { email: "alex@example.com" },
      request,
    });
    expect(mocks.completePublicSignup.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendVerificationEmail.mock.invocationCallOrder[0]
    );
  });

  it("skips personal onboarding and public verification for trusted signup requests", async () => {
    const { createTrustedInvitationRequest } =
      await import("@/features/auth/lib/invitation-capability");
    mocks.dbLimit.mockResolvedValueOnce([{ id: "role-member" }]);

    await mocks.authConfig?.databaseHooks.user.create.after(
      {
        id: "user-1",
        name: "Alex",
        email: "alex@example.com",
        username: "alex",
      },
      { request: createTrustedInvitationRequest("https://example.com/api/auth/sign-up/email") }
    );

    expect(mocks.completePublicSignup).not.toHaveBeenCalled();
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
    expect(mocks.dbValues).toHaveBeenCalledWith({
      userId: "user-1",
      roleId: "role-member",
      assignedByUserId: null,
    });
  });

  it("returns a safe pending outcome when verification delivery fails after onboarding", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.dbLimit.mockResolvedValueOnce([{ id: "role-member" }]);
    mocks.sendVerificationEmail.mockRejectedValueOnce(new Error("SMTP unavailable"));

    await expect(
      mocks.authConfig?.databaseHooks.user.create.after({
        id: "user-1",
        name: "Alex",
        email: "alex@example.com",
        username: "alex",
      })
    ).resolves.toBeUndefined();

    expect(mocks.completePublicSignup).toHaveBeenCalledOnce();
    expect(mocks.dbDelete).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("compensates failed organization provisioning without sending verification", async () => {
    const failure = new Error("organization provisioning failed");
    mocks.completePublicSignup.mockRejectedValueOnce(failure);
    mocks.dbLimit.mockResolvedValueOnce([{ id: "role-member" }]);

    await expect(
      mocks.authConfig?.databaseHooks.user.create.after({
        id: "user-1",
        name: "Alex",
        email: "alex@example.com",
        username: "alex",
      })
    ).rejects.toBe(failure);

    expect(mocks.compensateFailedPublicSignup).toHaveBeenCalledWith("user-1");
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("assigns every newly registered user to the bootstrapped member role", async () => {
    mocks.dbLimit.mockResolvedValue([{ id: "role-member" }]);

    await mocks.authConfig?.databaseHooks.user.create.after({
      id: "user-1",
      name: "Alex",
      email: "alex@example.com",
      username: "alex",
    });

    expect(mocks.dbWhere).toHaveBeenCalledWith({
      and: [
        { column: "role.key", value: "member" },
        { column: "role.scope", value: "platform" },
      ],
    });
    expect(mocks.dbValues).toHaveBeenCalledWith({
      userId: "user-1",
      roleId: "role-member",
      assignedByUserId: null,
    });
    expect(mocks.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("compensates a public signup when platform role assignment insert fails before onboarding", async () => {
    const failure = new Error("platform role assignment insert failed");
    mocks.dbLimit.mockResolvedValueOnce([{ id: "role-member" }]);
    mocks.onConflictDoNothing.mockRejectedValueOnce(failure);

    await expect(
      mocks.authConfig?.databaseHooks.user.create.after(
        {
          id: "user-1",
          name: "Alex",
          email: "alex@example.com",
          username: "alex",
        },
        { request: new Request("https://example.com/api/auth/sign-up/email") }
      )
    ).rejects.toBe(failure);

    expect(mocks.compensateFailedPublicSignup).toHaveBeenCalledWith("user-1");
    expect(mocks.completePublicSignup).not.toHaveBeenCalled();
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("surfaces transactional cleanup failure while retaining the setup failure", async () => {
    const setupFailure = new Error("platform role assignment insert failed");
    const cleanupFailure = new Error("cleanup transaction failed");
    mocks.dbLimit.mockResolvedValueOnce([{ id: "role-member" }]);
    mocks.onConflictDoNothing.mockRejectedValueOnce(setupFailure);
    mocks.compensateFailedPublicSignup.mockRejectedValueOnce(cleanupFailure);

    await expect(
      mocks.authConfig?.databaseHooks.user.create.after({
        id: "user-1",
        name: "Alex",
        email: "alex@example.com",
        username: "alex",
      })
    ).rejects.toMatchObject({
      name: "AggregateError",
      errors: [setupFailure, cleanupFailure],
      cause: setupFailure,
    });
    expect(mocks.dbDelete).not.toHaveBeenCalled();
    expect(mocks.dbUpdate).not.toHaveBeenCalled();
    expect(mocks.completePublicSignup).not.toHaveBeenCalled();
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("compensates a public signup when platform role lookup fails before onboarding", async () => {
    const failure = new Error("platform role lookup failed");
    mocks.dbLimit.mockRejectedValueOnce(failure);

    await expect(
      mocks.authConfig?.databaseHooks.user.create.after(
        {
          id: "user-1",
          name: "Alex",
          email: "alex@example.com",
          username: "alex",
        },
        { request: new Request("https://example.com/api/auth/sign-up/email") }
      )
    ).rejects.toBe(failure);

    expect(mocks.compensateFailedPublicSignup).toHaveBeenCalledWith("user-1");
    expect(mocks.dbDelete).not.toHaveBeenCalled();
    expect(mocks.dbUpdate).not.toHaveBeenCalled();
    expect(mocks.completePublicSignup).not.toHaveBeenCalled();
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("compensates a trusted signup when platform role lookup fails", async () => {
    const { createTrustedInvitationRequest } =
      await import("@/features/auth/lib/invitation-capability");
    mocks.dbLimit.mockRejectedValueOnce(new Error("platform role lookup failed"));

    await expect(
      mocks.authConfig?.databaseHooks.user.create.after(
        {
          id: "user-1",
          name: "Alex",
          email: "alex@example.com",
          username: "alex",
        },
        {
          request: createTrustedInvitationRequest("https://example.com/api/auth/sign-up/email"),
        }
      )
    ).rejects.toThrow("platform role lookup failed");

    expect(mocks.compensateFailedTrustedSignup).toHaveBeenCalledWith("user-1");
    expect(mocks.dbDelete).not.toHaveBeenCalled();
    expect(mocks.completePublicSignup).not.toHaveBeenCalled();
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("fails registration authorization setup when the member role is missing", async () => {
    mocks.dbLimit.mockResolvedValue([]);

    await expect(
      mocks.authConfig?.databaseHooks.user.create.after({
        id: "user-1",
        name: "Alex",
        email: "alex@example.com",
        username: "alex",
      })
    ).rejects.toThrow("The member role has not been bootstrapped");
    expect(mocks.dbInsert).not.toHaveBeenCalled();
  });

  it("returns only authoritative active sessions and rejects protected access without one", async () => {
    const session = { user: { id: "user-1", emailVerified: true } };
    mocks.getSession.mockResolvedValueOnce(session).mockResolvedValueOnce(null);
    mocks.dbLimit.mockResolvedValueOnce([{ disabledAt: null }]);

    await expect(getCurrentSession()).resolves.toEqual(session);
    expect(mocks.getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      query: { disableCookieCache: true },
    });
    await expect(requireSession()).rejects.toThrow("Unauthorized");
  });

  it("clears the initial organization marker only after reading its persisted matching session", async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: { id: "user-1" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    });
    mocks.dbLimit
      .mockResolvedValueOnce([{ disabledAt: null }])
      .mockResolvedValueOnce([{ initialActiveOrganizationId: "org-1" }])
      .mockResolvedValueOnce([{ id: "session-1" }]);

    await expect(getCurrentSession()).resolves.toMatchObject({
      session: { activeOrganizationId: "org-1" },
    });

    expect(mocks.dbUpdate).toHaveBeenCalled();
    expect(mocks.dbSet).toHaveBeenCalledWith({ initialActiveOrganizationId: null });
  });

  it("keeps the marker when no persisted matching session is observed", async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: { id: "user-1" },
      session: { id: "session-1", activeOrganizationId: "org-1" },
    });
    mocks.dbLimit
      .mockResolvedValueOnce([{ disabledAt: null }])
      .mockResolvedValueOnce([{ initialActiveOrganizationId: "org-1" }])
      .mockResolvedValueOnce([]);

    await getCurrentSession();

    expect(mocks.dbUpdate).not.toHaveBeenCalled();
  });

  it("rejects an existing session when the current user is disabled", async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: "disabled-user" } });
    mocks.dbLimit.mockResolvedValueOnce([{ disabledAt: new Date() }]);

    await expect(getCurrentSession()).resolves.toBeNull();
  });
});
