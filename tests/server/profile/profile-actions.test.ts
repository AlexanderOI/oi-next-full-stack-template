import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    changeEmail: vi.fn(),
    changePassword: vi.fn(),
    updateUser: vi.fn(),
  },
  dbFrom: vi.fn(),
  dbLimit: vi.fn(),
  dbSelect: vi.fn(),
  dbWhere: vi.fn(),
  headers: vi.fn(),
  revalidatePath: vi.fn(),
  requireAuthorizedSession: vi.fn(),
  uploadImage: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => conditions),
  eq: vi.fn((column, value) => ({ column, value })),
  ne: vi.fn((column, value) => ({ column, value, operator: "ne" })),
}));
vi.mock("@/db/schema", () => ({ user: { id: "user.id", username: "user.username" } }));
vi.mock("@/db/drizzle", () => ({ db: { select: mocks.dbSelect } }));
vi.mock("@/features/auth/server", () => ({ auth: { api: mocks.auth } }));
vi.mock("@/features/authorization/server", () => ({
  PERMISSIONS: { PROFILE_UPDATE_OWN: "profile.update.own" },
  requireAuthorizedSession: mocks.requireAuthorizedSession,
}));
vi.mock("@/services/storage/cloudinary/upload-image", () => ({ uploadImage: mocks.uploadImage }));

import { changePassword } from "@/features/profile/actions/change-password";
import { updateAvatar } from "@/features/profile/actions/update-avatar";
import { updateProfile } from "@/features/profile/actions/update-profile";

const session = {
  user: {
    id: "user-1",
    name: "Alex Doe",
    username: "alex.doe",
    email: "alex@example.com",
  },
};

function imageFile(type = "image/png", size = 16) {
  return new File([new Uint8Array(size)], "avatar.png", { type });
}

describe("profile actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ cookie: "session=valid" }));
    mocks.requireAuthorizedSession.mockResolvedValue(session);
    mocks.dbSelect.mockReturnValue({ from: mocks.dbFrom });
    mocks.dbFrom.mockReturnValue({ where: mocks.dbWhere });
    mocks.dbWhere.mockReturnValue({ limit: mocks.dbLimit });
    mocks.dbLimit.mockResolvedValue([]);
    mocks.auth.updateUser.mockResolvedValue({ ...session.user, name: "Alex Smith" });
    mocks.auth.changeEmail.mockResolvedValue(undefined);
    mocks.auth.changePassword.mockResolvedValue(undefined);
    mocks.uploadImage.mockResolvedValue({ secureUrl: "https://cdn.example.com/avatar.png" });
  });

  describe("updateProfile", () => {
    it("rejects invalid details without querying or mutating user data", async () => {
      const result = await updateProfile({ name: "A", username: "INVALID", email: "invalid" });

      expect(result).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
      expect(mocks.dbSelect).not.toHaveBeenCalled();
      expect(mocks.auth.updateUser).not.toHaveBeenCalled();
      expect(mocks.auth.changeEmail).not.toHaveBeenCalled();
    });

    it("returns a field error when another user owns the normalized username", async () => {
      mocks.dbLimit.mockResolvedValue([{ id: "user-2" }]);

      await expect(
        updateProfile({ name: "Alex Doe", username: "alex.doe", email: "alex@example.com" })
      ).resolves.toEqual({
        success: false,
        code: "USERNAME_TAKEN",
        details: { username: ["usernameTaken"] },
      });
      expect(mocks.auth.updateUser).not.toHaveBeenCalled();
      expect(mocks.auth.changeEmail).not.toHaveBeenCalled();
    });

    it("skips identity writes when normalized profile values are unchanged", async () => {
      const result = await updateProfile({
        name: " Alex Doe ",
        username: " alex.doe ",
        email: " ALEX@EXAMPLE.COM ",
      });

      expect(result).toEqual({
        success: true,
        user: session.user,
        emailVerificationSent: false,
      });
      expect(mocks.auth.updateUser).not.toHaveBeenCalled();
      expect(mocks.auth.changeEmail).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
    });

    it("updates profile details and requests verification instead of replacing email directly", async () => {
      const result = await updateProfile({
        name: "Alex Smith",
        username: "alex.smith",
        email: "new@example.com",
      });

      expect(result).toMatchObject({ success: true, emailVerificationSent: true });
      expect(mocks.auth.updateUser).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: { name: "Alex Smith", username: "alex.smith" },
      });
      expect(mocks.auth.changeEmail).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: { newEmail: "new@example.com", callbackURL: "/profile" },
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
    });

    it("reports partial success when verification fails after profile details changed", async () => {
      mocks.auth.changeEmail.mockRejectedValue(new Error("SMTP unavailable"));

      await expect(
        updateProfile({
          name: "Alex Smith",
          username: "alex.smith",
          email: "new@example.com",
        })
      ).resolves.toEqual({
        success: false,
        profileUpdated: true,
        code: "EMAIL_VERIFICATION_FAILED",
      });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("changePassword", () => {
    it("rejects invalid confirmation before reading request or auth state", async () => {
      await expect(
        changePassword({ currentPassword: "old-password", newPassword: "new-password", confirmPassword: "different" })
      ).resolves.toEqual({ success: false, code: "VALIDATION_ERROR" });
      expect(mocks.headers).not.toHaveBeenCalled();
      expect(mocks.requireAuthorizedSession).not.toHaveBeenCalled();
      expect(mocks.auth.changePassword).not.toHaveBeenCalled();
    });

    it("changes the password and revokes other sessions for an authorized user", async () => {
      await expect(
        changePassword({
          currentPassword: "old-password",
          newPassword: "new-password",
          confirmPassword: "new-password",
        })
      ).resolves.toEqual({ success: true });
      expect(mocks.auth.changePassword).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: {
          currentPassword: "old-password",
          newPassword: "new-password",
          revokeOtherSessions: true,
        },
      });
    });

    it("returns a safe failure when authorization or Better Auth rejects the change", async () => {
      mocks.requireAuthorizedSession.mockRejectedValue(new Error("FORBIDDEN"));

      await expect(
        changePassword({
          currentPassword: "old-password",
          newPassword: "new-password",
          confirmPassword: "new-password",
        })
      ).resolves.toEqual({ success: false, code: "PASSWORD_CHANGE_FAILED" });
      expect(mocks.auth.changePassword).not.toHaveBeenCalled();
    });
  });

  describe("updateAvatar", () => {
    it.each([
      [imageFile("text/plain"), "AVATAR_INVALID_TYPE"],
      [imageFile("image/png", 5 * 1024 * 1024 + 1), "AVATAR_TOO_LARGE"],
    ])("rejects invalid files before authorization and storage", async (file, code) => {
      await expect(updateAvatar(file)).resolves.toEqual({ success: false, code });
      expect(mocks.requireAuthorizedSession).not.toHaveBeenCalled();
      expect(mocks.uploadImage).not.toHaveBeenCalled();
    });

    it("persists the secure URL only after a constrained image upload", async () => {
      const file = imageFile();

      await expect(updateAvatar(file)).resolves.toEqual({ success: true });
      expect(mocks.uploadImage).toHaveBeenCalledWith(file, {
        folder: "my-app/avatars",
        width: 256,
        height: 256,
        fit: "cover",
        format: "auto",
        quality: "auto",
        maxFileSize: 5 * 1024 * 1024,
      });
      expect(mocks.auth.updateUser).toHaveBeenCalledWith({
        headers: expect.any(Headers),
        body: { image: "https://cdn.example.com/avatar.png" },
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
    });

    it("translates storage failures without updating the profile", async () => {
      mocks.uploadImage.mockRejectedValue(new Error("Cloudinary unavailable"));

      await expect(updateAvatar(imageFile())).resolves.toEqual({
        success: false,
        code: "AVATAR_UPDATE_FAILED",
      });
      expect(mocks.auth.updateUser).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });
});
