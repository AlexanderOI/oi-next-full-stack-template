import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryResults: [] as unknown[][],
  updates: [] as unknown[],
  dbSelect: vi.fn(),
  revalidatePath: vi.fn(),
  requireAuthorizedSession: vi.fn(),
  signUpEmail: vi.fn(),
  requestInvitationPasswordReset: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => ({ and: conditions })),
  eq: vi.fn((column, value) => ({ column, value })),
  isNotNull: vi.fn((column) => ({ isNotNull: column })),
  or: vi.fn((...conditions) => ({ or: conditions })),
}));
vi.mock("@/db/schema", () => ({
  user: {
    id: "user.id",
    name: "user.name",
    email: "user.email",
    username: "user.username",
    locale: "user.locale",
    invitedAt: "user.invitedAt",
  },
}));
vi.mock("@/features/auth/server", () => ({
  createTrustedInvitationRequest: vi.fn((url: string) => new Request(url, { method: "POST" })),
  requestInvitationPasswordReset: mocks.requestInvitationPasswordReset,
  auth: {
    api: {
      signUpEmail: mocks.signUpEmail,
    },
  },
}));
vi.mock("@/features/authorization/server", () => ({
  requireAuthorizedSession: mocks.requireAuthorizedSession,
}));
vi.mock("@/db/drizzle", () => ({
  db: {
    select: mocks.dbSelect.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => mocks.queryResults.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values) => {
        mocks.updates.push(values);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => mocks.queryResults.shift() ?? []),
          })),
        };
      }),
    })),
  },
}));

import {
  inviteUser,
  resendUserInvitation,
} from "@/features/authorization/actions/manage-user-invitations";
import { userInvitationSchema } from "@/features/authorization/schemas/user-invitation-schema";

const input = {
  name: "  Alex   Smith ",
  email: " ALEX@Example.com ",
  username: " Alex.Smith ",
  locale: "es" as const,
};

describe("user invitation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryResults.length = 0;
    mocks.updates.length = 0;
    mocks.requireAuthorizedSession.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.signUpEmail.mockResolvedValue({
      token: null,
      user: { id: "user-1", email: "alex@example.com", username: "alex.smith" },
    });
    mocks.requestInvitationPasswordReset.mockResolvedValue(undefined);
  });

  it("requires invite permission, creates a pending member through Better Auth, and requests acceptance", async () => {
    mocks.queryResults.push([], [{ id: "user-1" }]);

    const result = await inviteUser(input);

    expect(mocks.requireAuthorizedSession).toHaveBeenCalledWith("authorization.users.invite");
    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      body: expect.objectContaining({
        name: "Alex Smith",
        email: "alex@example.com",
        username: "alex.smith",
        password: expect.stringMatching(/^[A-Za-z0-9_-]{40,}$/),
      }),
      request: expect.any(Request),
    });
    const password = mocks.signUpEmail.mock.calls[0]?.[0].body.password;
    expect(JSON.stringify(result)).not.toContain(password);
    expect(mocks.updates[0]).toEqual({ invitedAt: expect.any(Date), locale: "es" });
    expect(mocks.requestInvitationPasswordReset).toHaveBeenCalledWith(
      "alex@example.com",
      "/auth/reset-password"
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
    expect(result).toEqual({ success: true, data: { userId: "user-1" } });
  });

  it("maps validation, forbidden, and preflight duplicates without creating accounts", async () => {
    await expect(inviteUser({ ...input, locale: "fr" as "es" })).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });

    mocks.requireAuthorizedSession.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(inviteUser(input)).resolves.toEqual({ success: false, code: "FORBIDDEN" });

    mocks.queryResults.push([{ email: "alex@example.com", username: "different" }]);
    await expect(inviteUser(input)).resolves.toEqual({
      success: false,
      code: "DUPLICATE_EMAIL",
    });
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
  });

  it("denies an unauthorized malformed invitation before validation, lookup, or providers", async () => {
    const validateInvitation = vi.spyOn(userInvitationSchema, "safeParse");
    mocks.requireAuthorizedSession.mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(inviteUser({ ...input, locale: "fr" as "es" })).resolves.toEqual({
      success: false,
      code: "FORBIDDEN",
    });

    expect(validateInvitation).not.toHaveBeenCalled();
    expect(mocks.dbSelect).not.toHaveBeenCalled();
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
    expect(mocks.requestInvitationPasswordReset).not.toHaveBeenCalled();
    validateInvitation.mockRestore();
  });

  it("denies an unauthorized resend before pending-account lookup or providers", async () => {
    mocks.requireAuthorizedSession.mockRejectedValueOnce(new Error("FORBIDDEN"));

    await expect(resendUserInvitation("malformed-or-secret-id")).resolves.toEqual({
      success: false,
      code: "FORBIDDEN",
    });

    expect(mocks.dbSelect).not.toHaveBeenCalled();
    expect(mocks.requestInvitationPasswordReset).not.toHaveBeenCalled();
  });

  it("maps unauthenticated invitation calls to an explicit serializable result", async () => {
    mocks.requireAuthorizedSession.mockRejectedValue(new Error("Unauthorized"));

    await expect(inviteUser(input)).resolves.toEqual({
      success: false,
      code: "UNAUTHORIZED",
    });
    await expect(resendUserInvitation("user-1")).resolves.toEqual({
      success: false,
      code: "UNAUTHORIZED",
    });
    expect(mocks.dbSelect).not.toHaveBeenCalled();
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
    expect(mocks.requestInvitationPasswordReset).not.toHaveBeenCalled();
  });

  it("detects Better Auth synthetic duplicate-email success and username races", async () => {
    mocks.queryResults.push([], []);
    mocks.signUpEmail.mockResolvedValueOnce({
      token: null,
      user: { id: "synthetic-user", email: "alex@example.com", username: "alex.smith" },
    });
    await expect(inviteUser(input)).resolves.toEqual({
      success: false,
      code: "DUPLICATE_EMAIL",
    });

    mocks.queryResults.push([]);
    mocks.signUpEmail.mockRejectedValueOnce({ body: { code: "USERNAME_IS_ALREADY_TAKEN" } });
    await expect(inviteUser(input)).resolves.toEqual({
      success: false,
      code: "DUPLICATE_USERNAME",
    });

    mocks.queryResults.push([], [{ email: "different@example.com", username: "alex.smith" }]);
    mocks.signUpEmail.mockRejectedValueOnce({ body: { code: "FAILED_TO_CREATE_USER" } });
    await expect(inviteUser(input)).resolves.toEqual({
      success: false,
      code: "DUPLICATE_USERNAME",
    });
  });

  it("reports delivery failure truthfully while leaving the persisted account pending", async () => {
    mocks.queryResults.push([], [{ id: "user-1" }]);
    mocks.requestInvitationPasswordReset.mockRejectedValueOnce(new Error("SMTP unavailable"));

    await expect(inviteUser(input)).resolves.toEqual({
      success: false,
      code: "INVITATION_DELIVERY_FAILED",
      pendingUserId: "user-1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("resends only pending invitations and does not distinguish absent from accepted accounts", async () => {
    mocks.queryResults.push([]);
    await expect(resendUserInvitation("missing")).resolves.toEqual({
      success: false,
      code: "INVITATION_NOT_PENDING",
    });

    mocks.queryResults.push([
      { id: "user-1", email: "alex@example.com", invitedAt: new Date("2026-09-29T00:00:00Z") },
    ]);
    await expect(resendUserInvitation("user-1")).resolves.toEqual({
      success: true,
      data: { userId: "user-1" },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});
