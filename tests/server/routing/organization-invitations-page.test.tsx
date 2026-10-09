import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  resolve: vi.fn(),
  permissions: vi.fn(),
  memberPermissions: vi.fn(),
  list: vi.fn(),
  locale: "en",
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} /> }));
vi.mock("next-intl/server", () => ({ getTranslations: async () => (key: string) => key }));
vi.mock("@/features/auth/server", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/features/organizations/client", () => ({
  OrganizationInvitationAdministration: () => null,
}));
vi.mock("@/features/organizations/server", () => ({
  resolveOrganizationContext: mocks.resolve,
  getOrganizationInvitationPermissions: mocks.permissions,
  getOrganizationMemberPermissions: mocks.memberPermissions,
  getOrganizationDeletionAvailability: vi.fn().mockResolvedValue(false),
  listOrganizationInvitations: mocks.list,
}));

import OrganizationInvitationsPage from "@/app/(app)/org/[organizationSlug]/invitations/page";
import OrganizationPage from "@/app/(app)/org/[organizationSlug]/page";

const context = {
  userId: "user-1",
  sessionId: "session-1",
  organizationId: "tenant-a",
  organizationSlug: "alpha",
  organizationName: "Alpha",
  membershipId: "member-a",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    user: { id: "user-1" },
    session: { id: "session-1", activeOrganizationId: "tenant-a" },
  });
  mocks.resolve.mockResolvedValue({ ok: true, context });
  mocks.permissions.mockResolvedValue({
    canRead: true,
    canCreate: true,
    canResend: true,
    canCancel: true,
    canUpdateMemberRoles: true,
    canTransferOwnership: false,
  });
  mocks.memberPermissions.mockResolvedValue({ canRead: false });
  mocks.list.mockResolvedValue({ rows: [], roles: [], total: 0, page: 1, pageSize: 20 });
});

describe("organization invitations route", () => {
  it("requires matching active organization context and read permission before tenant query", async () => {
    await OrganizationInvitationsPage({
      params: Promise.resolve({ organizationSlug: "alpha" }),
      searchParams: Promise.resolve({ page: "3", perPage: "25", search: "sam", status: "pending" }),
    });
    expect(mocks.resolve).toHaveBeenCalledWith("alpha", {
      user: { id: "user-1" },
      session: { id: "session-1", activeOrganizationId: "tenant-a" },
    });
    expect(mocks.permissions).toHaveBeenCalledWith("user-1", "tenant-a");
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "tenant-a",
        page: 3,
        pageSize: 25,
        search: "sam",
        status: "pending",
      })
    );
  });

  it("stops before permission or tenant reads when URL/session organization context mismatches", async () => {
    mocks.resolve.mockResolvedValue({ ok: false, code: "ORGANIZATION_CONTEXT_MISMATCH" });
    await expect(
      OrganizationInvitationsPage({
        params: Promise.resolve({ organizationSlug: "alpha" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.permissions).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("shows the workspace management link only with invitation read permission", async () => {
    mocks.permissions.mockResolvedValue({ canRead: false });
    const denied = await OrganizationPage({
      params: Promise.resolve({ organizationSlug: "alpha" }),
    });
    expect(JSON.stringify(denied)).not.toContain("/invitations");

    mocks.permissions.mockResolvedValue({ canRead: true });
    const allowed = await OrganizationPage({
      params: Promise.resolve({ organizationSlug: "alpha" }),
    });
    expect(JSON.stringify(allowed)).toContain("/org/alpha/invitations");
    expect(JSON.stringify(allowed)).toContain("manageInvitations");
  });

  it("does not query or render invitation data without invitation read permission", async () => {
    mocks.permissions.mockResolvedValue({ canRead: false });
    await expect(
      OrganizationInvitationsPage({
        params: Promise.resolve({ organizationSlug: "alpha" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
