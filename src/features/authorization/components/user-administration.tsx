"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import {
  createDataTableParsers,
  DataTable,
  DataTableToolbar,
  type DataTableLabels,
  useDataTable,
} from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import type { RoleSummary } from "../interfaces/role-summary";
import type { UserAdministrationPermissions } from "../interfaces/user-administration-permissions";
import type { UserRoleSummary } from "../interfaces/user-role-summary";
import { createUserAdministrationColumns } from "./user-administration-columns";

const columnIds = ["search", "name", "username", "roles", "verification", "access", "actions"];
const parsers = createDataTableParsers({
  columnIds,
  defaultSorting: [{ id: "name", desc: false }],
});
const DEFAULT_PAGE_SIZE = 10;
const columnWidths = {
  name: 28,
  username: 15,
  roles: 22,
  verification: 15,
  access: 12,
  actions: 8,
};

interface Props {
  actorUserId: string;
  users: UserRoleSummary[];
  roles: readonly RoleSummary[];
  permissions: UserAdministrationPermissions;
}

export function UserAdministration({ actorUserId, users, roles, permissions }: Props) {
  const t = useTranslations("authorization.users");

  const dataTableLabels = useMemo<DataTableLabels>(
    () => ({
      columns: t("table.columns"),
      rowsPerPage: t("table.rowsPerPage"),
      goToPage: (page: number) => t("table.goToPage", { page }),
      sortAscending: t("table.sortAscending"),
      sortDescending: t("table.sortDescending"),
      clearSorting: t("table.clearSorting"),
      hideColumn: t("table.hideColumn"),
      columnLabels: {
        name: t("table.name"),
        username: t("table.username"),
        roles: t("table.roles"),
        verification: t("table.verification"),
        access: t("table.access"),
      },
    }),
    [t]
  );
  const columns = useMemo(
    () =>
      createUserAdministrationColumns({
        actorUserId,
        roles,
        permissions,
        dataTableLabels,
        labels: {
          name: t("table.name"),
          username: t("table.username"),
          roles: t("table.roles"),
          verification: t("table.verification"),
          access: t("table.access"),
          actions: t("table.actions"),
          usernameMissing: t("table.usernameMissing"),
          roleMissing: t("table.roleMissing"),
          invitationPending: t("status.invitationPending"),
          verified: t("status.verified"),
          unverified: t("status.unverified"),
          active: t("status.active"),
          disabled: t("status.disabled"),
        },
      }),
    [actorUserId, dataTableLabels, permissions, roles, t]
  );
  const table = useDataTable({
    columns,
    data: users,
    pageCount: Math.max(1, Math.ceil(users.length / DEFAULT_PAGE_SIZE)),
    parsers,
    getRowId: (row) => row.id,
    initialColumnVisibility: { search: false },
    manualFiltering: false,
    manualPagination: false,
    manualSorting: false,
  });
  const searchColumn = table.getColumn("search");

  return (
    <DataTable
      table={table}
      columnWidths={columnWidths}
      emptyMessage={t("table.emptyFiltered")}
      labels={dataTableLabels}
      toolbar={
        <DataTableToolbar table={table} labels={dataTableLabels}>
          <Input
            type="search"
            className="max-w-sm"
            aria-label={t("table.searchLabel")}
            placeholder={t("table.searchPlaceholder")}
            value={(searchColumn?.getFilterValue() as string | undefined) ?? ""}
            onChange={(event) => searchColumn?.setFilterValue(event.target.value)}
          />
        </DataTableToolbar>
      }
    />
  );
}
