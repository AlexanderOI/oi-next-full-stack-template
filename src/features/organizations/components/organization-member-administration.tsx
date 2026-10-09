"use client";

import { useMemo, useState, useTransition } from "react";
import { useQueryState } from "nuqs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  DataTable,
  DataTableToolbar,
  createDataTableParsers,
  useDataTable,
  type DataTableLabels,
} from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { resendOrganizationMemberActivation } from "../actions/admin-provisioning";
import type { OrganizationMemberPage, OrganizationMemberRow } from "../contracts";
import { createOrganizationMemberColumns } from "./organization-member-columns";
import { ProvisionOrganizationMemberDialog } from "./provision-organization-member-dialog";
import { TransferOrganizationOwnershipDialog } from "./transfer-organization-ownership-dialog";

interface Props {
  data: OrganizationMemberPage;
  canProvision: boolean;
  canCreateRestriction: boolean;
  canManageAccess?: boolean;
  canTransferOwnership?: boolean;
  canRemoveMembers?: boolean;
  actorMembershipId?: string;
  actorUserId?: string;
}

const parsers = createDataTableParsers({
  columnIds: ["name", "email", "username", "status", "createdAt", "roles", "activation"],
  defaultPageSize: 20,
  defaultSorting: [{ id: "name", desc: false }],
});

export function OrganizationMemberAdministration({
  data,
  canProvision,
  canCreateRestriction,
  canManageAccess = false,
  canTransferOwnership = false,
  canRemoveMembers = false,
  actorMembershipId = "",
  actorUserId = "",
}: Props) {
  const t = useTranslations("organizations.members");
  const router = useRouter();
  const [search, setSearch] = useQueryState("search", { defaultValue: "", shallow: false });
  const [, setPage] = useQueryState("page", parsers.page);
  const [feedback, setFeedback] = useState("");
  const [pending, startTransition] = useTransition();
  const dataTableLabels: DataTableLabels = {
    columns: t("dataTable.columns"),
    rowsPerPage: t("dataTable.rowsPerPage"),
    goToPage: (page) => t("dataTable.goToPage", { page }),
    sortAscending: t("dataTable.sortAscending"),
    sortDescending: t("dataTable.sortDescending"),
    clearSorting: t("dataTable.clearSorting"),
    hideColumn: t("dataTable.hideColumn"),
    columnLabels: {
      name: t("dataTable.columnLabels.name"),
      email: t("dataTable.columnLabels.email"),
      username: t("dataTable.columnLabels.username"),
      status: t("dataTable.columnLabels.status"),
      roles: t("dataTable.columnLabels.roles"),
      createdAt: t("dataTable.columnLabels.createdAt"),
      activation: t("dataTable.columnLabels.activation"),
      actions: t("dataTable.columnLabels.actions"),
    },
  };
  const rowsForTable = canManageAccess
    ? data.rows
    : data.rows.map((row) => ({ ...row, identityDisabled: false }));
  const columns = useMemo(
    () =>
      createOrganizationMemberColumns(
        {
          name: t("name"),
          email: t("email"),
          username: t("username"),
          status: t("status"),
          statusActive: t("statusActive"),
          statusSuspended: t("statusSuspended"),
          roles: t("roles"),
          created: t("created"),
          activation: t("activation"),
          pending: t("activationPending"),
          activated: t("activationComplete"),
          resend: t("resend"),
          identityDisabled: t("identityDisabled"),
        },
        (userId) => {
          startTransition(async () => {
            try {
              const result = await resendOrganizationMemberActivation(userId);
              setFeedback(
                result.success
                  ? t("resendSuccess")
                  : result.code === "INVITATION_DELIVERY_FAILED"
                    ? t("deliveryFailed")
                    : t("resendFailed")
              );
              router.refresh();
            } catch {
              setFeedback(t("resendFailed"));
            }
          });
        },
        canProvision,
        canManageAccess,
        canRemoveMembers,
        actorUserId
      ),
    [actorUserId, canManageAccess, canProvision, canRemoveMembers, router, startTransition, t]
  );
  const table = useDataTable<OrganizationMemberRow>({
    columns,
    data: rowsForTable,
    pageCount: Math.ceil(data.total / data.pageSize),
    parsers,
    getRowId: (row) => row.id,
  });
  const toolbar = (
    <DataTableToolbar table={table} labels={dataTableLabels}>
      <Input
        aria-label={t("search")}
        placeholder={t("search")}
        value={search}
        onChange={(event) => {
          void setPage(null);
          void setSearch(event.currentTarget.value || null);
        }}
      />
      {canProvision && (
        <ProvisionOrganizationMemberDialog canCreateRestriction={canCreateRestriction} />
      )}
      {canTransferOwnership && (
        <TransferOrganizationOwnershipDialog
          rows={rowsForTable}
          actorMembershipId={actorMembershipId}
        />
      )}
      {pending && <span role="status">{t("pending")}</span>}
    </DataTableToolbar>
  );
  return (
    <section aria-labelledby="organization-members-title" className="space-y-4">
      <h2 id="organization-members-title" className="text-lg font-medium">
        {t("title")}
      </h2>
      {feedback && (
        <p role="status" aria-live="polite">
          {feedback}
        </p>
      )}
      <DataTable
        table={table}
        toolbar={toolbar}
        labels={dataTableLabels}
        emptyMessage={t("empty")}
      />
    </section>
  );
}
