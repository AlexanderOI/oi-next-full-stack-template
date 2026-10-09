import { getTableColumns } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  defaultDataTableLabels,
  type DataTableLabels,
} from "@/components/ui/data-table/data-table-labels";
import { membershipRole, platformRoleAssignment, role, rolePermission, user } from "@/db/schema";
import {
  permissionCatalog,
  permissionKeys,
  platformPermissionKeys,
  PERMISSIONS,
  type UserRoleSummary,
} from "@/features/authorization/contracts";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

interface MigrationSnapshot {
  id: string;
  prevIds: string[];
  ddl: Record<string, unknown>[];
}

const bootstrapMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("../../../src/db/drizzle", () => ({
  db: { transaction: bootstrapMocks.transaction },
  dbPool: { end: vi.fn() },
}));

const projectRoot = process.cwd();
const migrationDirectory = join(projectRoot, "drizzle/20260929020651_jittery_sprite");
const predecessorDirectory = join(projectRoot, "drizzle/20260816230459_little_la_nuit");

describe("user administration foundations", () => {
  beforeEach(() => {
    bootstrapMocks.transaction.mockReset();
  });

  it("synchronizes protected system roles and their exact grants after persisted drift", async () => {
    type RoleRow = Record<string, unknown> & { id: string };
    type PermissionLink = { roleId: string; permissionKey: string };
    type PlatformAssignment = { userId: string; roleId: string; assignedByUserId: null };
    type MembershipAssignment = { userId: string; roleId: string; organizationId: string };

    const roleRows: RoleRow[] = [];
    const permissionLinks: PermissionLink[] = [];
    const users = [{ id: "platform-admin-user" }, { id: "unassigned-user" }];
    const platformAssignments: PlatformAssignment[] = [
      { userId: "platform-admin-user", roleId: "system:admin", assignedByUserId: null },
    ];
    const membershipAssignments: MembershipAssignment[] = [
      { userId: "platform-admin-user", roleId: "organization-member", organizationId: "org-1" },
    ];
    const baselineMembershipAssignments = structuredClone(membershipAssignments);
    const transaction = async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        insert(table: unknown) {
          return {
            values(values: unknown) {
              const rows = (Array.isArray(values) ? values : [values]) as Record<string, unknown>[];
              if (table === rolePermission) permissionLinks.push(...(rows as PermissionLink[]));
              if (table === membershipRole) {
                membershipAssignments.push(...(rows as MembershipAssignment[]));
              }
              return {
                async onConflictDoUpdate({ set }: { set: Record<string, unknown> }) {
                  if (table !== role) return;
                  for (const values of rows) {
                    const existing = roleRows.find((row) => row.id === values.id);
                    if (existing) Object.assign(existing, set);
                    else roleRows.push({ ...values } as RoleRow);
                  }
                },
                async onConflictDoNothing() {
                  if (table !== platformRoleAssignment) return;
                  for (const row of rows as PlatformAssignment[]) {
                    if (
                      !platformAssignments.some((assignment) => assignment.userId === row.userId)
                    ) {
                      platformAssignments.push(row);
                    }
                  }
                },
              };
            },
          };
        },
        delete(table: unknown) {
          return {
            where(condition: { queryChunks?: unknown[] }) {
              if (table === rolePermission) {
                const roleId = condition.queryChunks?.find(
                  (chunk): chunk is { value: string } =>
                    typeof chunk === "object" &&
                    chunk !== null &&
                    "value" in chunk &&
                    typeof chunk.value === "string" &&
                    chunk.value.startsWith("system:")
                )?.value;
                if (roleId) {
                  for (let index = permissionLinks.length - 1; index >= 0; index -= 1) {
                    if (permissionLinks[index]?.roleId === roleId) permissionLinks.splice(index, 1);
                  }
                }
              }
              return Promise.resolve(undefined);
            },
          };
        },
        select() {
          return {
            from(table: unknown) {
              return {
                where() {
                  return table === role
                    ? {
                        limit: async () => {
                          const memberRole = roleRows.find(
                            (row) => row.key === "member" && row.scope === "platform"
                          );
                          return memberRole ? [{ id: memberRole.id }] : [];
                        },
                      }
                    : Promise.resolve(
                        table === user
                          ? users
                              .filter(
                                ({ id }) =>
                                  !platformAssignments.some(
                                    (assignment) => assignment.userId === id
                                  )
                              )
                              .map(({ id }) => ({ userId: id }))
                          : []
                      );
                },
              };
            },
          };
        },
      } as never);
    bootstrapMocks.transaction.mockImplementation(transaction);

    const { bootstrapAuthorization } = await import("../../../scripts/bootstrap-authorization");
    await bootstrapAuthorization();

    const organizationPermissionKeys = permissionCatalog
      .flatMap(({ permissions }) => permissions)
      .filter(({ scope }) => scope === "organization")
      .map(({ key }) => key);
    const expectedAdminPermissions = organizationPermissionKeys.filter(
      (key) =>
        ![
          PERMISSIONS.ORGANIZATION_DELETE,
          PERMISSIONS.ORGANIZATION_OWNERSHIP_TRANSFER,
          PERMISSIONS.ORGANIZATION_RESTRICTIONS_CREATE,
          PERMISSIONS.ORGANIZATION_ALLOWLIST_GRANTS_READ,
          PERMISSIONS.ORGANIZATION_ALLOWLIST_GRANTS_CREATE,
        ].some((excluded) => excluded === key)
    );
    const expectedPermissions: Record<string, readonly string[]> = {
      "system:member": [PERMISSIONS.PROFILE_READ_OWN, PERMISSIONS.PROFILE_UPDATE_OWN],
      "system:admin": platformPermissionKeys,
      "system:organization:owner": organizationPermissionKeys,
      "system:organization:admin": expectedAdminPermissions,
      "system:organization:member": [
        PERMISSIONS.ORGANIZATION_READ,
        PERMISSIONS.ORGANIZATION_MEMBERS_READ,
      ],
    };
    const initialRoleIds = roleRows.map(({ id }) => id);

    const driftedOwner = roleRows.find((row) => row.id === "system:organization:owner");
    expect(driftedOwner).toBeDefined();
    Object.assign(driftedOwner!, { name: "Drifted owner", description: "Stale definition" });
    const ownerGrant = permissionLinks.find((link) => link.roleId === "system:organization:owner");
    expect(ownerGrant).toBeDefined();
    permissionLinks.splice(permissionLinks.indexOf(ownerGrant!), 1);
    permissionLinks.push({
      roleId: "system:organization:member",
      permissionKey: PERMISSIONS.PROFILE_READ_OWN,
    });

    await bootstrapAuthorization();

    expect(roleRows.map(({ id }) => id).sort()).toEqual([...initialRoleIds].sort());
    expect(new Set(roleRows.map(({ id }) => id)).size).toBe(roleRows.length);
    expect(roleRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "system:member",
          key: "member",
          name: "Member",
          description: "Default access for every authenticated user",
          scope: "platform",
          isProtected: true,
          isSystem: true,
        }),
        expect.objectContaining({
          id: "system:admin",
          key: "admin",
          name: "Administrator",
          description: "Full explicit application administration access",
          scope: "platform",
          isProtected: true,
          isSystem: true,
        }),
        expect.objectContaining({
          id: "system:organization:owner",
          key: "owner",
          name: "Owner",
          description: "Full organization administration access",
          scope: "organization",
          organizationId: null,
          isProtected: true,
          isSystem: true,
        }),
        expect.objectContaining({
          id: "system:organization:admin",
          key: "admin",
          name: "Administrator",
          description:
            "Organization administration without destructive or security-sensitive grants",
          scope: "organization",
          organizationId: null,
          isProtected: true,
          isSystem: true,
        }),
        expect.objectContaining({
          id: "system:organization:member",
          key: "member",
          name: "Member",
          description: "Read-only organization and member access",
          scope: "organization",
          organizationId: null,
          isProtected: true,
          isSystem: true,
        }),
      ])
    );
    expect(roleRows.filter((row) => row.scope === "organization")).toHaveLength(3);
    expect(roleRows.filter((row) => row.scope === "platform")).toHaveLength(2);
    for (const [roleId, expectedKeys] of Object.entries(expectedPermissions)) {
      const persistedKeys = permissionLinks
        .filter((link) => link.roleId === roleId)
        .map((link) => link.permissionKey);
      expect(persistedKeys.sort()).toEqual([...expectedKeys].sort());
      expect(new Set(persistedKeys).size).toBe(persistedKeys.length);
    }
    expect(permissionLinks).toHaveLength(
      Object.values(expectedPermissions).reduce((total, keys) => total + keys.length, 0)
    );
    expect(platformAssignments).toEqual([
      { userId: "platform-admin-user", roleId: "system:admin", assignedByUserId: null },
      { userId: "unassigned-user", roleId: "system:member", assignedByUserId: null },
    ]);
    expect(new Set(platformAssignments.map(({ userId }) => userId)).size).toBe(
      platformAssignments.length
    );
    expect(membershipAssignments).toEqual(baselineMembershipAssignments);
  });
  it("uses platform assignments for global authorization, bootstrap, and admin grants", () => {
    const source = (path: string) => readFileSync(join(projectRoot, path), "utf8");
    const runtimeFiles = [
      "src/features/authorization/server.ts",
      "src/features/authorization/actions/manage-user-roles.ts",
      "src/features/authorization/actions/manage-user-access.ts",
      "src/features/authorization/actions/manage-roles.ts",
      "src/features/authorization/data/list-users-with-roles.ts",
      "src/features/auth/server.ts",
      "scripts/bootstrap-authorization.ts",
      "scripts/grant-admin.ts",
    ];

    for (const path of runtimeFiles) {
      expect(source(path), path).not.toMatch(/\buserRole\b|user_role/);
      expect(source(path), path).toContain("platformRoleAssignment");
    }
    expect(source("scripts/bootstrap-authorization.ts")).toContain('scope: "platform"');
    expect(source("src/features/authorization/server.ts")).toContain('eq(role.scope, "platform")');
    expect(source("src/features/auth/server.ts")).toContain('eq(role.scope, "platform")');
    expect(source("scripts/grant-admin.ts")).toContain('eq(role.scope, "platform")');
  });

  it("drops the legacy platform assignment table in a sequential migration without backfill", () => {
    const migrationPath = join(projectRoot, "drizzle/20261008001755_thin_swarm/migration.sql");
    const snapshotPath = join(projectRoot, "drizzle/20261008001755_thin_swarm/snapshot.json");
    const predecessorPath = join(
      projectRoot,
      "drizzle/20261008000043_ordinary_silvermane/snapshot.json"
    );
    const migrationSql = readFileSync(migrationPath, "utf8").trim();
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as MigrationSnapshot;
    const predecessor = JSON.parse(readFileSync(predecessorPath, "utf8")) as MigrationSnapshot;

    expect(migrationSql).toBe('DROP TABLE "user_role";');
    expect(snapshot.prevIds).toEqual([predecessor.id]);
    expect(snapshot.ddl.some((entity) => entity.name === "user_role")).toBe(false);
    expect(predecessor.ddl.some((entity) => entity.name === "user_role")).toBe(true);
  });

  it("keeps new data-table labels optional with English defaults", () => {
    const legacyLabels = {
      columns: "Legacy columns",
      rowsPerPage: "Legacy rows per page",
      goToPage: (page: number) => `Legacy page ${page}`,
    } satisfies DataTableLabels;

    expect(legacyLabels.goToPage(2)).toBe("Legacy page 2");
    expect(defaultDataTableLabels).toMatchObject({
      sortAscending: "Sort ascending",
      sortDescending: "Sort descending",
      clearSorting: "Clear sorting",
      hideColumn: "Hide column",
    });
  });

  it("bootstraps complete permission catalog metadata and platform-only system roles", () => {
    const bootstrapSource = readFileSync(
      join(projectRoot, "scripts/bootstrap-authorization.ts"),
      "utf8"
    );
    expect(bootstrapSource).toContain("category: section.key");
    expect(bootstrapSource).toContain("scope: definition.scope");
    expect(bootstrapSource).toContain("isProtected: definition.isProtected");
    expect(bootstrapSource).toContain('scope: "platform"');
    expect(bootstrapSource).toContain("isProtected: true");
    expect(bootstrapSource).toContain("platformPermissionKeys");
    expect(bootstrapSource).not.toContain("permissions: permissionKeys");
  });

  it("catalogs invitation and access-status permissions for administrator bootstrap", () => {
    const authorizationPermissions = permissionCatalog.find(
      (section) => section.key === "authorization"
    )?.permissions;

    expect(authorizationPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: PERMISSIONS.USERS_INVITE }),
        expect.objectContaining({ key: PERMISSIONS.USER_ACCESS_UPDATE }),
      ])
    );
    expect(permissionKeys).toEqual(
      expect.arrayContaining([PERMISSIONS.USERS_INVITE, PERMISSIONS.USER_ACCESS_UPDATE])
    );
    expect(platformPermissionKeys).toContain(PERMISSIONS.USERS_INVITE);
    expect(platformPermissionKeys).not.toContain(PERMISSIONS.ORGANIZATION_READ);
    expect(platformPermissionKeys).not.toContain(PERMISSIONS.ORGANIZATION_RESTRICTIONS_CREATE);

    const bootstrapSource = readFileSync(
      join(projectRoot, "scripts/bootstrap-authorization.ts"),
      "utf8"
    );
    expect(bootstrapSource).toContain('key: "admin"');
    expect(bootstrapSource).toContain("permissions: platformPermissionKeys");
    expect(bootstrapSource).not.toContain("permissions: permissionKeys");

    const roleEditorSource = readFileSync(
      join(projectRoot, "src/features/authorization/components/role-editor.tsx"),
      "utf8"
    );
    expect(roleEditorSource).toContain("platformPermissionKeys.includes(key)");

    const roleActionSource = readFileSync(
      join(projectRoot, "src/features/authorization/actions/manage-roles.ts"),
      "utf8"
    );
    expect(roleActionSource).toContain("roleInputSchema.safeParse(input)");
  });

  it("localizes administration permissions and access outcomes in English and Spanish", () => {
    expect(en.authorization.permissions.authorization.users.invite).toEqual({
      name: "Invite users",
      description: "Invite new users to create an account",
    });
    expect(en.authorization.permissions.authorization["user-access"].update).toEqual({
      name: "Manage user access",
      description: "Disable and reactivate user access",
    });
    expect(es.authorization.permissions.authorization.users.invite).toEqual({
      name: "Invitar usuarios",
      description: "Invitar a nuevos usuarios a crear una cuenta",
    });
    expect(es.authorization.permissions.authorization["user-access"].update).toEqual({
      name: "Gestionar el acceso de usuarios",
      description: "Desactivar y reactivar el acceso de usuarios",
    });

    expect(en.authorization.users.table).toMatchObject({
      sortAscending: "Sort ascending",
      sortDescending: "Sort descending",
      clearSorting: "Clear sorting",
      hideColumn: "Hide column",
    });
    expect(es.authorization.users.table).toMatchObject({
      sortAscending: "Orden ascendente",
      sortDescending: "Orden descendente",
      clearSorting: "Borrar orden",
      hideColumn: "Ocultar columna",
    });
    expect(en.authorization.users.errors).toMatchObject({
      UNAUTHORIZED: "You must be signed in to perform this action.",
      FORBIDDEN: "You do not have permission to perform this action.",
      INVITATION_FAILED: "The invitation could not be created.",
      ACCESS_UPDATE_FAILED: "User access could not be updated.",
    });
    expect(es.authorization.users.errors).toMatchObject({
      UNAUTHORIZED: "Debes iniciar sesión para realizar esta acción.",
      FORBIDDEN: "No tienes permiso para realizar esta acción.",
      INVITATION_FAILED: "No se pudo crear la invitación.",
      ACCESS_UPDATE_FAILED: "No se pudo actualizar el acceso del usuario.",
    });
    expect(en.authorization.errors.unauthorized).toBe(
      "You must be signed in to perform this action."
    );
    expect(es.authorization.errors.unauthorized).toBe(
      "Debes iniciar sesión para realizar esta acción."
    );
  });

  it("keeps template-branded invitation email messages complete in both locales", () => {
    expect(en.emails.invitation).toEqual({
      subject: "You're invited to oi-nextjs",
      heading: "You're invited to oi-nextjs",
      message:
        "An administrator created an account for you. Use the secure link below to choose your password and accept the invitation.",
      button: "Accept invitation",
      ignore: "If you were not expecting this invitation, you can ignore this email.",
    });
    expect(es.emails.invitation).toEqual({
      subject: "Te han invitado a oi-nextjs",
      heading: "Te han invitado a oi-nextjs",
      message:
        "Un administrador ha creado una cuenta para ti. Usa el enlace seguro que aparece a continuación para elegir tu contraseña y aceptar la invitación.",
      button: "Aceptar invitación",
      ignore: "Si no esperabas esta invitación, puedes ignorar este correo electrónico.",
    });
  });

  it("keeps user listing server-only behind the authorization server boundary", () => {
    const dataSource = readFileSync(
      join(projectRoot, "src/features/authorization/data/list-users-with-roles.ts"),
      "utf8"
    );
    const serverBoundary = readFileSync(
      join(projectRoot, "src/features/authorization/server.ts"),
      "utf8"
    );

    expect(dataSource.startsWith('import "server-only";')).toBe(true);
    expect(serverBoundary).toContain(
      'import { listUsersWithRoles } from "./data/list-users-with-roles";'
    );
    expect(serverBoundary).toContain("export { listUsersWithRoles,");
  });

  it("defines nullable invitation and disabled lifecycle timestamps", () => {
    const columns = getTableColumns(user);
    const invitedAt = new Date("2026-09-28T10:00:00.000Z");
    const summary = {
      id: "user-1",
      name: "Alex",
      email: "alex@example.com",
      emailVerified: false,
      username: "alex",
      invitedAt,
      disabledAt: null,
      roleIds: [],
    } satisfies UserRoleSummary;

    expect(columns.invitedAt).toMatchObject({ name: "invited_at", notNull: false });
    expect(columns.disabledAt).toMatchObject({ name: "disabled_at", notNull: false });
    expectTypeOf<UserRoleSummary["invitedAt"]>().toEqualTypeOf<Date | null>();
    expectTypeOf<UserRoleSummary["disabledAt"]>().toEqualTypeOf<Date | null>();
    expect(summary.invitedAt).toBe(invitedAt);
    expect(summary.disabledAt).toBeNull();
  });

  it("keeps the generated lifecycle migration isolated and linked to its predecessor", () => {
    const sql = readFileSync(join(migrationDirectory, "migration.sql"), "utf8");
    const statements = sql
      .replaceAll("--> statement-breakpoint", "")
      .split(";")
      .map((statement) => statement.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    expect(statements).toEqual([
      'ALTER TABLE "user" ADD COLUMN "invited_at" timestamp',
      'ALTER TABLE "user" ADD COLUMN "disabled_at" timestamp',
    ]);

    const snapshot = JSON.parse(
      readFileSync(join(migrationDirectory, "snapshot.json"), "utf8")
    ) as MigrationSnapshot;
    const predecessor = JSON.parse(
      readFileSync(join(predecessorDirectory, "snapshot.json"), "utf8")
    ) as MigrationSnapshot;
    const serialize = (entity: Record<string, unknown>) => JSON.stringify(entity);
    const snapshotEntities = new Set(snapshot.ddl.map(serialize));
    const predecessorEntities = new Set(predecessor.ddl.map(serialize));
    const addedEntities = snapshot.ddl.filter(
      (entity) => !predecessorEntities.has(serialize(entity))
    );
    const removedEntities = predecessor.ddl.filter(
      (entity) => !snapshotEntities.has(serialize(entity))
    );

    expect(snapshot.prevIds).toEqual([predecessor.id]);
    expect(removedEntities).toEqual([]);
    expect(addedEntities).toEqual([
      {
        type: "timestamp",
        typeSchema: null,
        notNull: false,
        dimensions: 0,
        default: null,
        generated: null,
        identity: null,
        name: "invited_at",
        entityType: "columns",
        schema: "public",
        table: "user",
      },
      {
        type: "timestamp",
        typeSchema: null,
        notNull: false,
        dimensions: 0,
        default: null,
        generated: null,
        identity: null,
        name: "disabled_at",
        entityType: "columns",
        schema: "public",
        table: "user",
      },
    ]);
  });
});
