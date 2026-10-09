import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  query: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/drizzle", () => ({ db: { select: mocks.dbSelect } }));
vi.mock("@/db/schema", () => ({
  member: {
    id: "member.id",
    organizationId: "member.organizationId",
    userId: "member.userId",
    status: "member.status",
  },
  organization: { id: "organization.id", slug: "organization.slug", name: "organization.name" },
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions) => conditions),
  eq: vi.fn((column, value) => ({ column, value })),
}));

import { resolveOrganizationContext } from "@/features/organizations/lib/resolve-organization-context";

const orgA = { id: "org-a", slug: "alpha", name: "Alpha" };
const orgB = { id: "org-b", slug: "bravo", name: "Bravo" };
const activeMembershipA = {
  id: "membership-a",
  organizationId: "org-a",
  userId: "user-1",
  status: "active",
};
const activeMembershipB = {
  id: "membership-b",
  organizationId: "org-b",
  userId: "user-1",
  status: "active",
};

function configureDatabase({
  organizations = [orgA, orgB],
  memberships = [activeMembershipA, activeMembershipB],
} = {}) {
  mocks.dbSelect.mockImplementation((selection) => {
    mocks.query.mockImplementation(() => ({
      from: (table: { id?: string; slug?: string; organizationId?: string }) => ({
        where: (conditions: { column: string; value: unknown }[]) => ({
          limit: async () => {
            const conditionList = Array.isArray(conditions) ? conditions : [conditions];
            if (table.slug || table.id === "organization.id") {
              const row = organizations.find((organization) =>
                conditionList.every(({ column, value }) => {
                  if (column === "organization.slug") return organization.slug === value;
                  if (column === "organization.id") return organization.id === value;
                  return true;
                })
              );
              return row ? [row] : [];
            }
            const row = memberships.find((membership) =>
              conditionList.every(({ column, value }) => {
                if (column === "member.organizationId") return membership.organizationId === value;
                if (column === "member.userId") return membership.userId === value;
                if (column === "member.status") return membership.status === value;
                return true;
              })
            );
            return row ? [row] : [];
          },
        }),
      }),
    }));
    return mocks.query(selection);
  });
}

let currentSession: {
  user: { id: string };
  session: { id: string; activeOrganizationId: string | null };
} | null;

function setSession(activeOrganizationId: string | null = "org-a") {
  currentSession = {
    user: { id: "user-1" },
    session: { id: "session-1", activeOrganizationId },
  };
}

describe("resolveOrganizationContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configureDatabase();
    setSession();
  });

  it("returns serializable context only when URL and active session organization match", async () => {
    const result = await resolveOrganizationContext("alpha", currentSession);

    expect(result).toEqual({
      ok: true,
      context: {
        userId: "user-1",
        sessionId: "session-1",
        organizationId: "org-a",
        organizationSlug: "alpha",
        organizationName: "Alpha",
        membershipId: "membership-a",
      },
    });
    expect(JSON.stringify(result)).not.toContain("status");
  });

  it("checks URL membership before requiring selection when session has no active organization", async () => {
    setSession(null);
    await expect(resolveOrganizationContext("alpha", currentSession)).resolves.toMatchObject({
      ok: false,
      error: "ORGANIZATION_CONTEXT_REQUIRED",
      target: { organizationId: "org-a", organizationSlug: "alpha", membershipId: "membership-a" },
    });
    configureDatabase({ memberships: [activeMembershipA] });
    await expect(resolveOrganizationContext("bravo", currentSession)).resolves.toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
  });

  it("does not choose between different valid session and URL organizations", async () => {
    await expect(resolveOrganizationContext("bravo", currentSession)).resolves.toMatchObject({
      ok: false,
      error: "ORGANIZATION_CONTEXT_MISMATCH",
      target: { organizationId: "org-b", organizationSlug: "bravo", membershipId: "membership-b" },
      active: {
        organizationId: "org-a",
        organizationSlug: "alpha",
        organizationName: "Alpha",
        membershipId: "membership-a",
      },
    });
  });

  it("invalidates stale active context before hiding an inaccessible URL organization", async () => {
    configureDatabase({ memberships: [activeMembershipA] });
    setSession("org-deleted");

    await expect(resolveOrganizationContext("bravo", currentSession)).resolves.toEqual({
      ok: false,
      error: "ORGANIZATION_CONTEXT_INVALIDATED",
    });
  });

  it("does not disclose a URL organization without active membership", async () => {
    configureDatabase({ memberships: [activeMembershipA] });
    await expect(resolveOrganizationContext("bravo", currentSession)).resolves.toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
  });

  it("hides suspended or missing target memberships", async () => {
    configureDatabase({
      memberships: [activeMembershipA, { ...activeMembershipB, status: "suspended" }],
    });
    await expect(resolveOrganizationContext("bravo", currentSession)).resolves.toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
    configureDatabase({ memberships: [activeMembershipA] });
    await expect(resolveOrganizationContext("bravo", currentSession)).resolves.toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
  });

  it("reports deleted, missing, or inactive active-organization context without selecting another organization", async () => {
    configureDatabase({ organizations: [orgB] });
    await expect(resolveOrganizationContext("bravo", currentSession)).resolves.toEqual({
      ok: false,
      error: "ORGANIZATION_CONTEXT_INVALIDATED",
    });
    configureDatabase({ memberships: [activeMembershipB] });
    await expect(resolveOrganizationContext("bravo", currentSession)).resolves.toEqual({
      ok: false,
      error: "ORGANIZATION_CONTEXT_INVALIDATED",
    });
    configureDatabase({
      memberships: [{ ...activeMembershipA, status: "suspended" }, activeMembershipB],
    });
    await expect(resolveOrganizationContext("bravo", currentSession)).resolves.toEqual({
      ok: false,
      error: "ORGANIZATION_CONTEXT_INVALIDATED",
    });
  });

  it("returns not found for invalid URL slugs", async () => {
    await expect(resolveOrganizationContext("---", currentSession)).resolves.toEqual({
      ok: false,
      error: "NOT_FOUND",
    });
  });

  it("fails closed without an authenticated enabled session", async () => {
    currentSession = null;
    await expect(resolveOrganizationContext("alpha", currentSession)).resolves.toEqual({
      ok: false,
      error: "FORBIDDEN",
    });
  });
});
