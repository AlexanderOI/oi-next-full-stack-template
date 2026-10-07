import { getTableColumns } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";

import { defaultDataTableLabels, type DataTableLabels } from "@/components/ui/data-table/data-table-labels";
import { user } from "@/db/schema";
import {
  permissionCatalog,
  permissionKeys,
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

const projectRoot = process.cwd();
const migrationDirectory = join(projectRoot, "drizzle/20260929020651_jittery_sprite");
const predecessorDirectory = join(projectRoot, "drizzle/20260816230459_little_la_nuit");

describe("user administration foundations", () => {
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

    const bootstrapSource = readFileSync(
      join(projectRoot, "scripts/bootstrap-authorization.ts"),
      "utf8"
    );
    expect(bootstrapSource).toContain('key: "admin"');
    expect(bootstrapSource).toContain("permissions: permissionKeys");
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
