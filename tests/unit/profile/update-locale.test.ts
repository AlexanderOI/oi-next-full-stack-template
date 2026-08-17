import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  revalidatePath: vi.fn(),
  requireSession: vi.fn(),
  eq: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  where: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: mocks.cookieSet })) }));
vi.mock("@/config/env", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("@/features/auth/server", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/db/drizzle", () => ({ db: { update: mocks.update } }));
vi.mock("@/db/schema", () => ({ user: { id: "user.id" } }));
vi.mock("drizzle-orm", () => ({ eq: mocks.eq }));

import { updateLocale } from "@/features/profile/actions/update-locale";

describe("updateLocale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.set.mockReturnValue({ where: mocks.where });
    mocks.where.mockResolvedValue(undefined);
    mocks.eq.mockImplementation((column, value) => ({ column, value }));
  });

  it("updates only the authenticated user, writes continuity cookie, and revalidates", async () => {
    await expect(updateLocale("es")).resolves.toEqual({ success: true, locale: "es" });
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ locale: "es" }));
    expect(mocks.eq).toHaveBeenCalledWith("user.id", "user-1");
    expect(mocks.where).toHaveBeenCalledWith({ column: "user.id", value: "user-1" });
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "APP_LOCALE",
      "es",
      expect.objectContaining({ httpOnly: true, path: "/", sameSite: "lax" })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("rejects invalid values before authentication or persistence", async () => {
    await expect(updateLocale("fr")).resolves.toEqual({
      success: false,
      code: "INVALID_LOCALE",
    });
    expect(mocks.requireSession).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    mocks.requireSession.mockRejectedValue(new Error("UNAUTHORIZED"));
    await expect(updateLocale("es")).resolves.toEqual({
      success: false,
      code: "UNAUTHORIZED",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
