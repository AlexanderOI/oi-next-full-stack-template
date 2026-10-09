import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  resolve: vi.fn(),
  permissions: vi.fn(),
  list: vi.fn(),
  locale: "en",
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next-intl/server", () => ({
  getTranslations: () => (key: string) =>
    key === "workspace" && mocks.locale === "es" ? "Espacio de trabajo de la organización" : key,
}));
vi.mock("@/features/auth/server", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/features/organizations/client", () => ({
  OrganizationMemberAdministration: () => null,
  OrganizationDeletionPanel: () => null,
}));
vi.mock("@/features/organizations/server", () => ({
  getOrganizationDeletionAvailability: vi.fn().mockResolvedValue(false),
  resolveOrganizationContext: mocks.resolve,
  getOrganizationMemberPermissions: mocks.permissions,
  listOrganizationMembers: mocks.list,
}));

import OrganizationMembersPage from "@/app/(app)/org/[organizationSlug]/members/page";
import OrganizationPage from "@/app/(app)/org/[organizationSlug]/page";

const context = {
  userId: "user-1",
  sessionId: "session-1",
  organizationId: "org-a",
  organizationSlug: "alpha",
  organizationName: "Alpha",
  membershipId: "member-a",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.session.mockResolvedValue({
    user: { id: "user-1" },
    session: { id: "session-1", activeOrganizationId: "org-a" },
  });
  mocks.resolve.mockResolvedValue({ ok: true, context });
  mocks.permissions.mockResolvedValue({
    canRead: true,
    canProvision: false,
    canCreateRestriction: false,
    canManageAccess: false,
  });
  mocks.list.mockResolvedValue({ rows: [], total: 0, page: 1, pageSize: 20 });
});

describe("organization members route", () => {
  it("resolves validated URL/session context, requires read, and queries with derived tenant and URL filters", async () => {
    await OrganizationMembersPage({
      params: Promise.resolve({ organizationSlug: "alpha" }),
      searchParams: Promise.resolve({
        page: "3",
        perPage: "25",
        search: "sam",
        sort: '[{"id":"email","desc":true}]',
      }),
    });
    expect(mocks.resolve).toHaveBeenCalledWith("alpha", {
      user: { id: "user-1" },
      session: { id: "session-1", activeOrganizationId: "org-a" },
    });
    expect(mocks.permissions).toHaveBeenCalledWith("user-1", "org-a");
    expect(mocks.list).toHaveBeenCalledWith({
      organizationId: "org-a",
      includeIdentityDisabled: false,
      page: 3,
      pageSize: 25,
      search: "sam",
      sort: "email",
      direction: "desc",
    });
  });

  it("does not query member data without organization.members.read", async () => {
    mocks.permissions.mockResolvedValue({
      canRead: false,
      canProvision: true,
      canCreateRestriction: true,
    });
    await expect(
      OrganizationMembersPage({
        params: Promise.resolve({ organizationSlug: "alpha" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("renders the localized workspace heading in Spanish", async () => {
    mocks.locale = "es";
    const page = await OrganizationPage({ params: Promise.resolve({ organizationSlug: "alpha" }) });
    expect(JSON.stringify(page)).toContain("Espacio de trabajo de la organización");
  });

  it("shows the workspace Manage members link only to members with read permission", async () => {
    mocks.permissions.mockResolvedValue({
      canRead: false,
      canProvision: false,
      canCreateRestriction: false,
    });
    const denied = await OrganizationPage({
      params: Promise.resolve({ organizationSlug: "alpha" }),
    });
    expect(JSON.stringify(denied)).not.toContain("manageMembers");
    mocks.permissions.mockResolvedValue({
      canRead: true,
      canProvision: false,
      canCreateRestriction: false,
    });
    const allowed = await OrganizationPage({
      params: Promise.resolve({ organizationSlug: "alpha" }),
    });
    expect(JSON.stringify(allowed)).toContain("/org/alpha/members");
  });
});
