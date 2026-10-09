import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PERMISSIONS = {
  ORGANIZATION_INVITATIONS_CREATE: "organization.invitations.create",
  ORGANIZATION_MEMBER_ROLES_UPDATE: "organization.member-roles.update",
  ORGANIZATION_INVITATIONS_RESEND: "organization.invitations.resend",
  ORGANIZATION_INVITATIONS_CANCEL: "organization.invitations.cancel",
  ORGANIZATION_OWNERSHIP_TRANSFER: "organization.ownership.transfer",
};

const fakeDb = vi.hoisted(() => ({
  state: null as FakeState | null,
  transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db/drizzle", () => ({ db: fakeDb }));
vi.mock("@/features/authorization/server", () => ({
  PERMISSIONS: {
    ORGANIZATION_INVITATIONS_CREATE: "organization.invitations.create",
    ORGANIZATION_MEMBER_ROLES_UPDATE: "organization.member-roles.update",
    ORGANIZATION_INVITATIONS_RESEND: "organization.invitations.resend",
    ORGANIZATION_INVITATIONS_CANCEL: "organization.invitations.cancel",
    ORGANIZATION_OWNERSHIP_TRANSFER: "organization.ownership.transfer",
  },
}));
vi.mock("@/features/organizations/email/organization-invitation-email", () => ({
  deliverOrganizationInvitation: vi.fn(),
}));

import {
  allowlistGrant,
  authorizationAudit,
  invitation,
  member,
  organization,
  role,
  user,
} from "@/db/schema";
import {
  cancelInvitation,
  createOrReplaceInvitation,
  invitationAuditTarget,
  type InvitationActor,
} from "@/features/organizations/lib/organization-invitations";

type InvitationRow = {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  inviterId: string;
};

type FakeState = {
  invitations: InvitationRow[];
  audits: Record<string, unknown>[];
  events: string[];
  permissions: string[];
  roles: Array<Record<string, unknown>>;
  identities: Array<Record<string, unknown>>;
  organizations: Array<Record<string, unknown>>;
  zeroTransition: boolean;
  insertConflict: boolean;
};

const actor: InvitationActor = {
  userId: "actor-1",
  organizationId: "org-1",
  membershipId: "membership-1",
};
const now = new Date("2032-04-05T06:07:08.000Z");
const oldInvitation: InvitationRow = {
  id: "old-capability-token",
  organizationId: "org-1",
  email: "person@example.com",
  role: "role-old",
  status: "pending",
  expiresAt: new Date("2032-04-07T06:07:08.000Z"),
  inviterId: "actor-1",
};

function makeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    invitations: [{ ...oldInvitation }],
    audits: [],
    events: [],
    permissions: [
      PERMISSIONS.ORGANIZATION_INVITATIONS_CREATE,
      PERMISSIONS.ORGANIZATION_MEMBER_ROLES_UPDATE,
      PERMISSIONS.ORGANIZATION_INVITATIONS_RESEND,
      PERMISSIONS.ORGANIZATION_INVITATIONS_CANCEL,
    ],
    roles: [
      {
        id: "role-new",
        key: "analyst",
        name: "Analyst",
        scope: "organization",
        organizationId: "org-1",
        isProtected: false,
      },
    ],
    identities: [],
    organizations: [{ id: "org-1", slug: "acme", name: "Acme" }],
    zeroTransition: false,
    insertConflict: false,
    ...overrides,
  };
}

function rowsForSelect(state: FakeState, table: unknown, joined: boolean) {
  if (table === role) return state.roles;
  if (table === member && joined)
    return state.permissions.map((permissionKey) => ({ permissionKey }));
  if (table === member) return [];
  if (table === user) return state.identities;
  if (table === allowlistGrant) return [];
  if (table === invitation) return state.invitations.filter((row) => row.status === "pending");
  if (table === organization) return state.organizations;
  return [];
}

function createExecutor(state: FakeState) {
  return {
    select: () => {
      let table: unknown;
      let joined = false;
      const builder = {
        from(value: unknown) {
          table = value;
          return this;
        },
        innerJoin() {
          joined = true;
          return this;
        },
        where() {
          return this;
        },
        limit() {
          return this;
        },
        for() {
          state.events.push("row-lock");
          return this;
        },
        then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) {
          try {
            return Promise.resolve(rowsForSelect(state, table, joined)).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).catch(reject);
          }
        },
      };
      return builder;
    },
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            state.events.push("conditional-update");
            if (table !== invitation || state.zeroTransition) return [];
            const pending = state.invitations.find((row) => row.status === "pending");
            if (!pending) return [];
            Object.assign(pending, values);
            return [{ id: pending.id }];
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        if (table === invitation) {
          state.events.push("insert-invitation");
          if (state.insertConflict) throw { code: "23505" };
          state.invitations.push(values as InvitationRow);
        } else if (table === authorizationAudit) {
          state.events.push("insert-audit");
          state.audits.push(values);
        }
      },
    }),
  };
}

function installState(state: FakeState) {
  fakeDb.state = state;
  fakeDb.transaction.mockImplementation(async (callback) => {
    const working = structuredClone(state) as FakeState;
    const result = await callback(createExecutor(working));
    Object.assign(state, working);
    return result;
  });
}

async function runCreate(expectedInvitationId = oldInvitation.id) {
  return createOrReplaceInvitation(
    actor,
    oldInvitation.email,
    "role-new",
    true,
    expectedInvitationId
  );
}

describe("organization invitation transactional service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it("cancels the expected pending row, inserts one fresh capability, then audits", async () => {
    const state = makeState({
      invitations: [
        { ...oldInvitation },
        ...Array.from({ length: 20 }, (_, index) => ({
          ...oldInvitation,
          id: `other-${index}`,
          email: `other-${index}@example.com`,
        })),
      ],
    });
    installState(state);

    const result = await runCreate();

    expect(typeof result).toBe("object");
    if (typeof result === "string") throw new Error(`Unexpected service result: ${result}`);
    const oldRow = state.invitations.find((row) => row.id === oldInvitation.id);
    const freshRows = state.invitations.filter(
      (row) => row.email === oldInvitation.email && row.status === "pending"
    );
    expect(oldRow?.status).toBe("canceled");
    expect(freshRows).toHaveLength(1);
    expect(freshRows[0].id).not.toBe(oldInvitation.id);
    expect(freshRows[0].role).toBe("role-new");
    expect(freshRows[0].expiresAt).toEqual(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000));
    expect(result.id).toBe(freshRows[0].id);
    expect(state.audits).toHaveLength(1);
    expect(state.events.indexOf("conditional-update")).toBeLessThan(
      state.events.indexOf("insert-invitation")
    );
    expect(state.events.indexOf("insert-invitation")).toBeLessThan(
      state.events.indexOf("insert-audit")
    );
  });

  it("does not update, insert, or audit when the expected pending ID changed", async () => {
    const state = makeState();
    installState(state);

    await expect(runCreate("stale-id")).resolves.toBe("NOT_PENDING");

    expect(state.invitations).toEqual([oldInvitation]);
    expect(state.events).not.toContain("conditional-update");
    expect(state.events).not.toContain("insert-invitation");
    expect(state.audits).toHaveLength(0);
  });

  it("returns a race and suppresses replacement insert/audit when the conditional transition affects zero rows", async () => {
    const state = makeState({ zeroTransition: true });
    installState(state);

    await expect(runCreate()).resolves.toBe("RACE");

    expect(state.invitations).toEqual([oldInvitation]);
    expect(state.events).toContain("conditional-update");
    expect(state.events).not.toContain("insert-invitation");
    expect(state.audits).toHaveLength(0);
  });

  it("does not report successful cancellation or audit when its conditional update affects zero rows", async () => {
    const state = makeState({ zeroTransition: true });
    installState(state);

    await expect(cancelInvitation(actor, oldInvitation.id)).resolves.toBe("NOT_PENDING");

    expect(state.invitations).toEqual([oldInvitation]);
    expect(state.events).toContain("conditional-update");
    expect(state.audits).toHaveLength(0);
  });

  it("rolls back a replacement when unique insertion conflicts and returns a race", async () => {
    const state = makeState({ insertConflict: true });
    installState(state);

    await expect(runCreate()).resolves.toBe("RACE");

    expect(state.invitations).toEqual([oldInvitation]);
    expect(state.audits).toHaveLength(0);
  });

  it("writes only a digest of the replacement capability in audit data", async () => {
    const state = makeState();
    installState(state);

    const result = await runCreate();
    if (typeof result === "string") throw new Error(`Unexpected service result: ${result}`);

    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].targetId).toBe(invitationAuditTarget(result.id));
    expect(state.audits[0].targetId).not.toBe(result.id);
    expect(JSON.stringify(state.audits[0])).not.toContain(result.id);
  });
});
