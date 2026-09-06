import { beforeEach, describe, expect, it, vi } from "vitest";

interface AuthConfiguration {
  emailAndPassword: {
    enabled: boolean;
    requireEmailVerification: boolean;
    sendResetPassword: (
      input: { user: { id: string; name: string; email: string }; url: string; token: string },
      request: Request
    ) => Promise<void>;
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
  };
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
  headers: vi.fn(),
  onConflictDoNothing: vi.fn(),
  sendLocalizedVerificationEmail: vi.fn(),
  sendLocalizedPasswordResetEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn((column, value) => ({ column, value })) }));
vi.mock("@better-auth/drizzle-adapter", () => ({ drizzleAdapter: vi.fn(() => "db-adapter") }));
vi.mock("better-auth/next-js", () => ({ nextCookies: vi.fn(() => "next-cookies") }));
vi.mock("better-auth/plugins", () => ({ username: vi.fn(() => "username-plugin") }));
vi.mock("@/db/schema", () => ({
  role: { id: "role.id", key: "role.key" },
  schema: {},
  userRole: "user-role-table",
}));
vi.mock("@/db/drizzle", () => ({
  db: { select: mocks.dbSelect, insert: mocks.dbInsert },
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
    return { api: { getSession: mocks.getSession }, $Infer: {} };
  }),
}));

import { getCurrentSession, requireSession } from "@/features/auth/server";

describe("authentication server boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ cookie: "session=valid" }));
    mocks.dbSelect.mockReturnValue({ from: mocks.dbFrom });
    mocks.dbFrom.mockReturnValue({ where: mocks.dbWhere });
    mocks.dbWhere.mockReturnValue({ limit: mocks.dbLimit });
    mocks.dbInsert.mockReturnValue({ values: mocks.dbValues });
    mocks.dbValues.mockReturnValue({ onConflictDoNothing: mocks.onConflictDoNothing });
    mocks.onConflictDoNothing.mockResolvedValue(undefined);
    mocks.sendLocalizedVerificationEmail.mockResolvedValue(undefined);
    mocks.sendLocalizedPasswordResetEmail.mockResolvedValue(undefined);
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

  it("returns only validated sessions and rejects protected access without one", async () => {
    const session = { user: { id: "user-1", emailVerified: true } };
    mocks.getSession.mockResolvedValueOnce(session).mockResolvedValueOnce(null);

    await expect(getCurrentSession()).resolves.toEqual(session);
    expect(mocks.getSession).toHaveBeenCalledWith({ headers: expect.any(Headers) });
    await expect(requireSession()).rejects.toThrow("Unauthorized");
  });
});
