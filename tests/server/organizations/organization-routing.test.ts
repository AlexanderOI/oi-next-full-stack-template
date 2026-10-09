import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  where: vi.fn(),
  innerJoin: vi.fn(),
  orderBy: vi.fn(),
  getCurrentSession: vi.fn(),
  authSetActive: vi.fn(),
  headers: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  updateWhere: vi.fn(),
  dbUpdate: vi.fn(),
  eq: vi.fn((column, value) => ({ column, value })),
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => ({ and: conditions })),
  eq: mocks.eq,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/db/drizzle", () => ({ db: { select: mocks.dbSelect, update: mocks.dbUpdate } }));
vi.mock("@/db/schema", () => ({
  member: {
    id: "member.id",
    userId: "member.userId",
    organizationId: "member.organizationId",
    status: "member.status",
  },
  organization: { id: "organization.id", slug: "organization.slug", name: "organization.name" },
  session: {
    id: "session.id",
    userId: "session.userId",
    activeOrganizationId: "session.activeOrganizationId",
  },
}));
vi.mock("@/features/auth/server", () => ({
  auth: { api: { setActiveOrganization: mocks.authSetActive } },
  getCurrentSession: mocks.getCurrentSession,
}));

import { clearInvalidOrganizationContext } from "@/features/organizations/actions/clear-invalid-organization-context";
import { switchOrganization } from "@/features/organizations/actions/switch-organization";
import { getActiveOrganizations } from "@/features/organizations/server";

function configureMembershipQuery(rows: unknown[]) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => Promise.resolve(rows)),
    limit: vi.fn(() => Promise.resolve(rows)),
  };
  mocks.dbSelect.mockReturnValue(query);
  mocks.dbUpdate.mockReturnValue({ set: mocks.set });
  return query;
}

function setSession(activeOrganizationId: string | null = "org-a") {
  mocks.getCurrentSession.mockResolvedValue({
    user: { id: "user-1" },
    session: { id: "session-1", activeOrganizationId },
  });
}

describe("organization routing and explicit context actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSession();
    mocks.headers.mockResolvedValue(new Headers({ cookie: "session-cookie" }));
    mocks.authSetActive.mockResolvedValue({ id: "org-b" });
    mocks.update.mockReturnValue({ set: mocks.set });
    mocks.set.mockReturnValue({ where: mocks.updateWhere });
    mocks.updateWhere.mockResolvedValue({ rowCount: 1 });
  });

  it("lists only the signed-in user's active memberships", async () => {
    const rows = [{ id: "org-a", slug: "alpha", name: "Alpha" }];
    const query = configureMembershipQuery(rows);
    await expect(getActiveOrganizations("user-1")).resolves.toEqual(rows);
    expect(query.innerJoin).toHaveBeenCalled();
    expect(query.where).toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith("member.userId", "user-1");
    expect(mocks.eq).toHaveBeenCalledWith("member.status", "active");
  });

  it("switches only to a revalidated active membership using the current request headers", async () => {
    configureMembershipQuery([{ id: "org-b", slug: "bravo", name: "Bravo" }]);
    await expect(switchOrganization("org-b")).resolves.toEqual({
      success: true,
      href: "/org/bravo",
    });
    expect(mocks.authSetActive).toHaveBeenCalledWith({
      body: { organizationId: "org-b" },
      headers: expect.any(Headers),
    });
    expect(mocks.authSetActive.mock.calls[0]?.[0].headers).toBe(
      await mocks.headers.mock.results[0]?.value
    );
  });

  it("rejects unauthenticated callers before querying or switching", async () => {
    mocks.getCurrentSession.mockResolvedValue(null);
    await expect(switchOrganization("org-b")).resolves.toEqual({
      success: false,
      code: "FORBIDDEN",
    });
    expect(mocks.dbSelect).not.toHaveBeenCalled();
    expect(mocks.authSetActive).not.toHaveBeenCalled();
  });

  it("denies unauthorized targets and rechecks already-active targets without changing session state", async () => {
    configureMembershipQuery([]);
    await expect(switchOrganization("org-b")).resolves.toEqual({
      success: false,
      code: "FORBIDDEN",
    });
    expect(mocks.authSetActive).not.toHaveBeenCalled();

    setSession("org-a");
    configureMembershipQuery([{ id: "org-a", slug: "alpha", name: "Alpha" }]);
    await expect(switchOrganization("org-a")).resolves.toEqual({
      success: true,
      href: "/org/alpha",
    });
    expect(mocks.authSetActive).not.toHaveBeenCalled();
  });

  it("clears stale context only when session, user, and observed organization all still match", async () => {
    setSession("org-stale");
    configureMembershipQuery([]);
    await expect(clearInvalidOrganizationContext()).resolves.toEqual({
      success: false,
      code: "ORGANIZATION_CONTEXT_INVALIDATED",
      href: "/org",
    });
    expect(mocks.updateWhere).toHaveBeenCalledOnce();
    const predicate = mocks.updateWhere.mock.calls[0]?.[0];
    expect(JSON.stringify(predicate)).toContain("session.id");
    expect(JSON.stringify(predicate)).toContain("session.userId");
    expect(predicate).toEqual({
      and: [
        { column: "session.id", value: "session-1" },
        { column: "session.userId", value: "user-1" },
        { column: "session.activeOrganizationId", value: "org-stale" },
      ],
    });
  });

  it("does not overwrite a concurrent explicit organization switch", async () => {
    setSession("org-stale");
    configureMembershipQuery([]);
    mocks.updateWhere.mockResolvedValue({ rowCount: 0 });
    await clearInvalidOrganizationContext();
    expect(mocks.updateWhere).toHaveBeenCalledOnce();
    expect(mocks.set).toHaveBeenCalledWith({ activeOrganizationId: null });
    expect(mocks.updateWhere).toHaveBeenCalledWith({
      and: [
        { column: "session.id", value: "session-1" },
        { column: "session.userId", value: "user-1" },
        { column: "session.activeOrganizationId", value: "org-stale" },
      ],
    });
  });
});
