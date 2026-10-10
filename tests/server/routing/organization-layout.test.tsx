import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  resolve: vi.fn(),
  organizations: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/features/auth/server", () => ({ getCurrentSession: mocks.session }));
vi.mock("@/features/organizations/server", () => ({
  getActiveOrganizations: mocks.organizations,
  resolveOrganizationContext: mocks.resolve,
}));
vi.mock("@/features/organizations/client", () => ({
  OrganizationContextChoice: () => null,
  OrganizationContextRecovery: () => null,
}));

import OrganizationLayout from "@/app/(app)/org/[organizationSlug]/layout";
import {
  OrganizationContextChoice,
  OrganizationContextRecovery,
} from "@/features/organizations/client";

const context = {
  userId: "user-1",
  sessionId: "session-1",
  organizationId: "org-a",
  organizationSlug: "alpha",
  organizationName: "Alpha",
  membershipId: "member-a",
};
const child = <p>private tenant content</p>;

async function renderLayout() {
  return OrganizationLayout({
    children: child,
    params: Promise.resolve({ organizationSlug: "alpha" }),
  });
}

describe("organization layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({
      user: { id: "user-1" },
      session: { id: "session-1", activeOrganizationId: "org-a" },
    });
    mocks.organizations.mockResolvedValue([{ id: "org-a", slug: "alpha", name: "Alpha" }]);
  });

  it("renders validated children without an embedded switcher", async () => {
    mocks.resolve.mockResolvedValue({ ok: true, context });
    const result = await renderLayout();
    expect(result.type).toBe("div");
    expect(result.props.children).toEqual([expect.objectContaining({ type: "h1" }), child]);
    expect(mocks.organizations).toHaveBeenCalledWith("user-1");
    expect(mocks.resolve).toHaveBeenCalledWith(
      "alpha",
      expect.objectContaining({
        session: expect.objectContaining({ activeOrganizationId: "org-a" }),
      })
    );
  });

  it("blocks children on mismatched active context", async () => {
    mocks.resolve.mockResolvedValue({
      ok: false,
      error: "ORGANIZATION_CONTEXT_MISMATCH",
      target: context,
      active: { ...context, organizationId: "org-b" },
    });
    const result = await renderLayout();
    expect(result.type).toBe(OrganizationContextChoice);
    expect(result.props.target).toEqual(context);
    expect(result.props.active.organizationId).toBe("org-b");
    expect(mocks.organizations).not.toHaveBeenCalled();
    expect(JSON.stringify(result.props)).not.toContain("private tenant content");
  });

  it("recovers if a validated membership is no longer available", async () => {
    mocks.resolve.mockResolvedValue({ ok: true, context });
    mocks.organizations.mockResolvedValue([]);
    const result = await renderLayout();
    expect(result.type).toBe(OrganizationContextRecovery);
    expect(JSON.stringify(result.props)).not.toContain("private tenant content");
  });

  it("recovers stale context and requests selection on absent context", async () => {
    mocks.resolve
      .mockResolvedValueOnce({ ok: false, error: "ORGANIZATION_CONTEXT_INVALIDATED" })
      .mockResolvedValueOnce({
        ok: false,
        error: "ORGANIZATION_CONTEXT_REQUIRED",
        target: context,
      });
    expect((await renderLayout()).type).toBe(OrganizationContextRecovery);
    const required = await renderLayout();
    expect(required.type).toBe(OrganizationContextChoice);
    expect(JSON.stringify(required.props)).not.toContain("private tenant content");
  });
});
