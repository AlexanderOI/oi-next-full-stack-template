import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  organizations: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));
vi.mock("@/features/organizations/lib/resolve-organization-context", () => ({
  resolveOrganizationContext: mocks.resolve,
}));
vi.mock("@/features/organizations/lib/list-current-active-organizations", () => ({
  getActiveOrganizations: mocks.organizations,
}));
vi.mock("@/features/organizations/actions/switch-organization", () => ({
  switchOrganization: vi.fn(),
}));
vi.mock("@/features/organizations/actions/clear-invalid-organization-context", () => ({
  clearInvalidOrganizationContext: vi.fn(),
}));

import { OrganizationContextChoice } from "@/features/organizations/components/organization-context-choice";
import { OrganizationContextRecovery } from "@/features/organizations/components/organization-context-recovery";
import { OrganizationRouteShell } from "@/features/organizations/components/organization-route-shell";

const protectedChild = <p>private tenant content</p>;
const context = {
  userId: "user-1",
  sessionId: "session-1",
  organizationId: "org-a",
  organizationSlug: "alpha",
  organizationName: "Alpha",
  membershipId: "member-a",
};
const activeOrganizations = [
  { id: "org-a", slug: "alpha", name: "Alpha" },
  { id: "org-b", slug: "bravo", name: "Bravo" },
];

async function renderRoute() {
  return OrganizationRouteShell({
    organizationSlug: "alpha",
    session: {
      user: { id: "user-1" },
      session: { id: "session-1", activeOrganizationId: "org-a" },
    },
    children: protectedChild,
  });
}

describe("organization route shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.organizations.mockResolvedValue(activeOrganizations);
  });

  it("renders protected children only for a matching validated context", async () => {
    mocks.resolve.mockResolvedValue({ ok: true, context });
    const result = await renderRoute();
    const renderedChildren = (result.props as { children: unknown[] }).children;
    expect(renderedChildren).toContain(protectedChild);
    expect(renderedChildren).not.toContainEqual(
      expect.objectContaining({ props: expect.objectContaining({ activeOrganizationId: "org-a" }) })
    );
  });

  it("recovers rather than exposing children after membership disappears", async () => {
    mocks.resolve.mockResolvedValue({ ok: true, context });
    mocks.organizations.mockResolvedValue([{ id: "org-b", slug: "bravo", name: "Bravo" }]);
    const result = await renderRoute();
    expect(result.type).toBe(OrganizationContextRecovery);
    expect(JSON.stringify(result.props)).not.toContain("private tenant content");
  });

  it.each([
    [
      "missing active context",
      {
        ok: false,
        error: "ORGANIZATION_CONTEXT_REQUIRED",
        target: { ...context, organizationId: "org-a" },
      },
      OrganizationContextChoice,
    ],
    [
      "active-context mismatch",
      {
        ok: false,
        error: "ORGANIZATION_CONTEXT_MISMATCH",
        target: { ...context, organizationId: "org-a" },
        active: { ...context, organizationId: "org-b" },
      },
      OrganizationContextChoice,
    ],
    [
      "stale active context",
      { ok: false, error: "ORGANIZATION_CONTEXT_INVALIDATED" },
      OrganizationContextRecovery,
    ],
  ])("never renders protected children on %s", async (_case, outcome, expectedComponent) => {
    mocks.resolve.mockResolvedValue(outcome);
    const result = await renderRoute();
    expect(result.type).toBe(expectedComponent);
    expect(JSON.stringify(result.props)).not.toContain("private tenant content");
  });

  it("returns not-found without disclosing an inaccessible target", async () => {
    mocks.resolve.mockResolvedValue({ ok: false, error: "NOT_FOUND" });
    await expect(renderRoute()).rejects.toThrow("NOT_FOUND");
    expect(mocks.organizations).not.toHaveBeenCalled();
  });
});
