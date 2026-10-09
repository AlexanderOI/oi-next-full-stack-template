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
import {
  cancelOrganizationInvitation,
  resendOrganizationInvitation,
} from "../actions/organization-invitations";
import type { OrganizationInvitationPage } from "../contracts";
import type { OrganizationInvitationAdminRow } from "../interfaces/organization-invitation-admin";
import { createOrganizationInvitationColumns } from "./organization-invitation-columns";
import { CreateOrganizationInvitationDialog } from "./create-organization-invitation-dialog";

interface Props {
  data: OrganizationInvitationPage;
  canCreate: boolean;
  canResend: boolean;
  canCancel: boolean;
  canTransferOwnership: boolean;
}

const parsers = createDataTableParsers({
  columnIds: ["email", "role", "effectiveStatus", "expiresAt", "createdAt"],
  defaultPageSize: 20,
  defaultSorting: [{ id: "createdAt", desc: true }],
});

export function OrganizationInvitationAdministration({
  data,
  canCreate,
  canResend,
  canCancel,
  canTransferOwnership,
}: Props) {
  const t = useTranslations("organizations.invitations");
  const router = useRouter();
  const [search, setSearch] = useQueryState("search", { defaultValue: "", shallow: false });
  const [status, setStatus] = useQueryState("status", { defaultValue: "all", shallow: false });
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
      email: t("dataTable.columnLabels.email"),
      role: t("dataTable.columnLabels.role"),
      effectiveStatus: t("dataTable.columnLabels.status"),
      expiresAt: t("dataTable.columnLabels.expiresAt"),
      createdAt: t("dataTable.columnLabels.createdAt"),
      actions: t("dataTable.columnLabels.actions"),
    },
  };

  const columns = useMemo(
    () =>
      createOrganizationInvitationColumns(
        {
          email: t("email"),
          role: t("role"),
          status: t("status"),
          pending: t("statusPending"),
          expired: t("statusExpired"),
          accepted: t("statusAccepted"),
          rejected: t("statusRejected"),
          canceled: t("statusCanceled"),
          expiresAt: t("expiresAt"),
          createdAt: t("createdAt"),
          resend: t("resend"),
          cancel: t("cancel"),
        },
        (invitationId) => {
          startTransition(async () => {
            try {
              const result = await resendOrganizationInvitation({ invitationId });
              setFeedback(
                result.success
                  ? t("resendSuccess")
                  : result.code === "INVITATION_DELIVERY_FAILED"
                    ? t("deliveryFailed")
                    : t("actionFailed")
              );
              router.refresh();
            } catch {
              setFeedback(t("actionFailed"));
            }
          });
        },
        (invitationId) => {
          startTransition(async () => {
            try {
              const result = await cancelOrganizationInvitation({ invitationId });
              setFeedback(result.success ? t("cancelSuccess") : t("actionFailed"));
              router.refresh();
            } catch {
              setFeedback(t("actionFailed"));
            }
          });
        },
        { canResend, canCancel }
      ),
    [canCancel, canResend, router, startTransition, t]
  );
  const table = useDataTable<OrganizationInvitationAdminRow>({
    columns,
    data: data.rows,
    pageCount: Math.ceil(data.total / data.pageSize),
    parsers,
    getRowId: (row) => row.id,
  });
  const roles = data.roles.filter(
    (roleOption) => canTransferOwnership || !(roleOption.isProtected && roleOption.key === "owner")
  );
  const statusFilters = [
    { value: "all", label: t("statusFilter.all") },
    { value: "pending", label: t("statusFilter.pending") },
    { value: "expired", label: t("statusFilter.expired") },
    { value: "accepted", label: t("statusFilter.accepted") },
    { value: "rejected", label: t("statusFilter.rejected") },
    { value: "canceled", label: t("statusFilter.canceled") },
  ];
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
      <select
        aria-label={t("filterStatus")}
        value={status}
        onChange={(event) => {
          void setPage(null);
          void setStatus(event.currentTarget.value === "all" ? null : event.currentTarget.value);
        }}
      >
        {statusFilters.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {canCreate && <CreateOrganizationInvitationDialog roles={roles} />}
      {pending && <span role="status">{t("working")}</span>}
    </DataTableToolbar>
  );
  return (
    <section aria-labelledby="organization-invitations-title" className="space-y-4">
      <h2 id="organization-invitations-title" className="text-lg font-medium">
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
