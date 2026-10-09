import { describe, expect, it, vi } from "vitest";

const countMarker = vi.hoisted(() => Symbol("count"));
vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm")>("drizzle-orm");
  return {
    ...actual,
    and: (...conditions: unknown[]) => ({ type: "and", conditions }),
    eq: (column: unknown, value: unknown) => ({ type: "eq", column, value }),
    count: () => countMarker,
  };
});

import { member, organization } from "@/db/schema";
import { assertActiveMemberCapacity } from "@/features/organizations/lib/active-member-capacity";

type Condition =
  { type: "and"; conditions: Condition[] } | { type: "eq"; column: unknown; value: unknown };
type MemberRow = { organizationId: string; status: string };

function flatten(condition: Condition | undefined): Array<Extract<Condition, { type: "eq" }>> {
  if (!condition) return [];
  if (condition.type === "eq") return [condition];
  return condition.conditions.flatMap((child) => flatten(child));
}

function executor(
  rows: MemberRow[],
  events: string[],
  options: {
    acquireLock?: () => Promise<() => void>;
    onRelease?: (release: () => void) => void;
  } = {}
) {
  return {
    select: (projection: Record<string, unknown>) => {
      let selectedTable: unknown;
      let condition: Condition | undefined;
      let lockRequested = false;
      const query = {
        from(table: unknown) {
          selectedTable = table;
          return query;
        },
        where(value: Condition) {
          condition = value;
          return query;
        },
        for() {
          events.push("lock-organization");
          lockRequested = true;
          return query;
        },
        async then(resolve: (value: unknown[]) => unknown, reject: (error: unknown) => unknown) {
          try {
            if (selectedTable === organization) {
              if (lockRequested && options.acquireLock) {
                const release = await options.acquireLock();
                options.onRelease?.(release);
              }
              events.push("organization-read");
              return await Promise.resolve([{ id: "org-1" }]).then(resolve, reject);
            }

            events.push("member-count");
            const predicates = flatten(condition);
            const organizationPredicate = predicates.find(
              (item) => item.column === member.organizationId
            );
            const statusPredicate = predicates.find((item) => item.column === member.status);
            events.push(
              statusPredicate?.value === "active"
                ? "active-status-predicate"
                : "missing-active-filter"
            );
            const count = rows.filter(
              (row) =>
                (!organizationPredicate || row.organizationId === organizationPredicate.value) &&
                (!statusPredicate || row.status === statusPredicate.value)
            ).length;
            return await Promise.resolve([{ count }]).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).catch(reject);
          }
        },
      };
      // Drizzle passes a projection object; identify COUNT without relying on an internal SQL shape.
      if (Object.values(projection).includes(countMarker)) events.push("count-projection");
      return query;
    },
  };
}

function activeRows(count: number): MemberRow[] {
  return Array.from({ length: count }, () => ({ organizationId: "org-1", status: "active" }));
}

function acquireQueue() {
  let tail = Promise.resolve();
  return async () => {
    const previous = tail;
    let unlock!: () => void;
    tail = new Promise<void>((resolve) => (unlock = resolve));
    await previous;
    return unlock;
  };
}

describe("shared active-member capacity", () => {
  it("counts active rows only, excluding suspended memberships", async () => {
    const events: string[] = [];
    const rows = [
      ...activeRows(999),
      ...Array.from({ length: 12 }, () => ({ organizationId: "org-1", status: "suspended" })),
    ];

    await expect(
      assertActiveMemberCapacity(executor(rows, events) as never, "org-1")
    ).resolves.toBeUndefined();

    expect(events).toContain("active-status-predicate");
    expect(events).toEqual([
      "lock-organization",
      "organization-read",
      "count-projection",
      "member-count",
      "active-status-predicate",
    ]);
  });

  it("allows the 999th active membership and rejects at 1,000", async () => {
    const events: string[] = [];
    await expect(
      assertActiveMemberCapacity(executor(activeRows(999), events) as never, "org-1")
    ).resolves.toBeUndefined();
    await expect(
      assertActiveMemberCapacity(executor(activeRows(1000), events) as never, "org-1")
    ).rejects.toThrow("ORGANIZATION_MEMBER_LIMIT_REACHED");
  });

  it("admits exactly one concurrent check/count/insert at the final slot under the shared lock", async () => {
    const rows = activeRows(999);
    rows.push({ organizationId: "org-1", status: "suspended" });
    const events: string[] = [];
    const acquireLock = acquireQueue();

    const contender = async () => {
      let release: (() => void) | undefined;
      const tx = executor(rows, events, {
        acquireLock,
        onRelease: (unlock) => (release = unlock),
      });
      try {
        await assertActiveMemberCapacity(tx as never, "org-1");
        rows.push({ organizationId: "org-1", status: "active" });
        events.push("insert-active-member");
      } finally {
        release?.();
      }
    };

    const outcomes = await Promise.allSettled([contender(), contender()]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(rows.filter((row) => row.status === "active")).toHaveLength(1000);
    expect(rows.filter((row) => row.status === "suspended")).toHaveLength(1);
    expect(events).toContain("active-status-predicate");
    expect(events).toHaveLength(2 * 5 + 1);
  });
});
