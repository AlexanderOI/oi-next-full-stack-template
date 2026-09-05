import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertAnyPermission: vi.fn(),
  getSession: vi.fn(),
  headers: vi.fn(),
  next: vi.fn(),
  redirect: vi.fn(),
  routeRedirect: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({
  redirect: mocks.routeRedirect.mockImplementation((path) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/server", () => ({
  NextResponse: {
    next: mocks.next,
    redirect: mocks.redirect,
  },
}));
vi.mock("@/features/auth/server", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/features/authorization/server", () => ({
  assertAnyPermission: mocks.assertAnyPermission,
  PERMISSIONS: {
    ROLES_READ: "authorization.roles.read",
    USERS_READ: "authorization.users.read",
  },
}));

import AdminLayout from "@/app/(app)/admin/layout";
import { proxy } from "../../../proxy";

describe("protected routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ cookie: "session=value" }));
    mocks.next.mockReturnValue({ kind: "next" });
    mocks.redirect.mockImplementation((url) => ({ kind: "redirect", url: url.toString() }));
  });

  it("redirects an anonymous dashboard request to sign in", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(
      proxy({ url: "https://example.com/dashboard" } as never)
    ).resolves.toEqual({
      kind: "redirect",
      url: "https://example.com/auth/sign-in",
    });
    expect(mocks.next).not.toHaveBeenCalled();
  });

  it("allows a dashboard request with a validated session", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });

    await expect(proxy({ url: "https://example.com/dashboard" } as never)).resolves.toEqual({
      kind: "next",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects users without administration read access to forbidden", async () => {
    mocks.assertAnyPermission.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(AdminLayout({ children: <main>Admin</main> })).rejects.toThrow(
      "REDIRECT:/forbidden"
    );
  });

  it("renders administration content when either accepted permission is granted", async () => {
    mocks.assertAnyPermission.mockResolvedValue(undefined);
    const child = <main>Admin</main>;

    await expect(AdminLayout({ children: child })).resolves.toBe(child);
    expect(mocks.assertAnyPermission).toHaveBeenCalledWith([
      "authorization.roles.read",
      "authorization.users.read",
    ]);
    expect(mocks.routeRedirect).not.toHaveBeenCalled();
  });
});
