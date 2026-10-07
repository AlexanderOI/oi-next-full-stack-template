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
    user: { create: { after: (user: { id: string }) => Promise<void> } };
    session: {
      create: { before: (session: { userId: string }) => Promise<boolean | void> };
    };
  };
  user: {
    additionalFields: Record<string, { type: string; required: boolean; input: boolean }>;
  };
  plugins: unknown[];
}

const mocks = vi.hoisted(() => ({
  authConfig: undefined as AuthConfiguration | undefined,
  betterAuth: vi.fn(),
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
  sendLocalizedPasswordResetEmail: vi.fn(),
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
vi.mock("better-auth/plugins", () => ({ username: vi.fn(() => "username-plugin") }));
vi.mock("@/db/schema", () => ({
  role: { id: "role.id", key: "role.key" },
  schema: {},
  userRole: "user-role-table",
  user: {
    id: "user.id",
    invitedAt: "user.invitedAt",
    emailVerified: "user.emailVerified",
    disabledAt: "user.disabledAt",
  },
}));
vi.mock("@/db/drizzle", () => ({
  db: { select: mocks.dbSelect, insert: mocks.dbInsert, update: mocks.dbUpdate },
}));
vi.mock("@/features/auth/email/verification-email-delivery", () => ({
  sendLocalizedVerificationEmail: mocks.sendLocalizedVerificationEmail,
}));
vi.mock("@/features/auth/email/password-reset-email-delivery", () => ({
  sendLocalizedPasswordResetEmail: mocks.sendLocalizedPasswordResetEmail,
}));
vi.mock("better-auth", () => ({
  betterAuth: mocks.betterAuth.mockImplementation((config) => {
    mocks.authConfig = config;
    return {
      api: {
        getSession: mocks.getSession,
        requestPasswordReset: mocks.requestPasswordReset,
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

describe("authentication server boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dbLimit.mockReset();
    mocks.headers.mockResolvedValue(new Headers({ cookie: "session=valid" }));
    mocks.dbSelect.mockReturnValue({ from: mocks.dbFrom });
    mocks.dbFrom.mockReturnValue({ where: mocks.dbWhere });
    mocks.dbWhere.mockReturnValue({ limit: mocks.dbLimit });
    mocks.dbInsert.mockReturnValue({ values: mocks.dbValues });
    mocks.dbValues.mockReturnValue({ onConflictDoNothing: mocks.onConflictDoNothing });
    mocks.dbUpdate.mockReturnValue({ set: mocks.dbSet });
    mocks.dbSet.mockReturnValue({ where: mocks.dbReturning });
    mocks.dbReturning.mockResolvedValue(undefined);
    mocks.onConflictDoNothing.mockResolvedValue(undefined);
    mocks.sendLocalizedVerificationEmail.mockResolvedValue(undefined);
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

  it("requires email verification and requests a verification message on registration", async () => {
    expect(mocks.authConfig).toMatchObject({
      emailAndPassword: { enabled: true, requireEmailVerification: true },
      emailVerification: { sendOnSignUp: true },
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

  it("exposes server-controlled user lifecycle timestamps to Better Auth", () => {
    expect(mocks.authConfig?.user.additionalFields).toMatchObject({
      invitedAt: { type: "date", required: false, input: false },
      disabledAt: { type: "date", required: false, input: false },
    });
  });

  it("rejects session creation for disabled users without the Better Auth admin plugin", async () => {
    mocks.dbLimit.mockResolvedValueOnce([{ disabledAt: new Date() }]);

    await expect(
      mocks.authConfig?.databaseHooks.session.create.before({ userId: "disabled-user" })
    ).resolves.toBe(false);
    expect(mocks.authConfig?.plugins).toEqual(["next-cookies", "username-plugin"]);
  });

  it("leaves ordinary active session creation unchanged", async () => {
    mocks.dbLimit.mockResolvedValueOnce([{ disabledAt: null }]);

    await expect(
      mocks.authConfig?.databaseHooks.session.create.before({ userId: "active-user" })
    ).resolves.toBeUndefined();
  });

  it("assigns every newly registered user to the bootstrapped member role", async () => {
    mocks.dbLimit.mockResolvedValue([{ id: "role-member" }]);

    await mocks.authConfig?.databaseHooks.user.create.after({ id: "user-1" });

    expect(mocks.dbValues).toHaveBeenCalledWith({ userId: "user-1", roleId: "role-member" });
    expect(mocks.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("fails registration authorization setup when the member role is missing", async () => {
    mocks.dbLimit.mockResolvedValue([]);

    await expect(
      mocks.authConfig?.databaseHooks.user.create.after({ id: "user-1" })
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

  it("rejects an existing session when the current user is disabled", async () => {
    mocks.getSession.mockResolvedValueOnce({ user: { id: "disabled-user" } });
    mocks.dbLimit.mockResolvedValueOnce([{ disabledAt: new Date() }]);

    await expect(getCurrentSession()).resolves.toBeNull();
  });
});
