"use client";

import type { DataTableColumnDef } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import type { OrganizationInvitationAdminRow } from "../interfaces/organization-invitation-admin";

export interface OrganizationInvitationColumnLabels {
  email: string;
  role: string;
  status: string;
  pending: string;
  expired: string;
  accepted: string;
  rejected: string;
  canceled: string;
  expiresAt: string;
  createdAt: string;
  resend: string;
  cancel: string;
}

export function createOrganizationInvitationColumns(
  labels: OrganizationInvitationColumnLabels,
  onResend: (invitationId: string) => void,
  onCancel: (invitationId: string) => void,
  permissions: { canResend: boolean; canCancel: boolean }
): DataTableColumnDef<OrganizationInvitationAdminRow>[] {
  return [
    {
      accessorKey: "email",
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.email} />,
    },
    {
      accessorKey: "roleName",
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.role} />,
    },
    {
      accessorKey: "effectiveStatus",
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.status} />,
      cell: ({ row }) => labels[row.original.effectiveStatus],
    },
    {
      accessorKey: "expiresAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.expiresAt} />,
      cell: ({ row }) => row.original.expiresAt.toLocaleDateString(),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.createdAt} />,
      cell: ({ row }) => row.original.createdAt.toLocaleDateString(),
    },
    ...(permissions.canResend || permissions.canCancel
      ? [
          {
            id: "actions",
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) =>
              row.original.status === "pending" ? (
                <div className="flex gap-2">
                  {permissions.canResend && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onResend(row.original.id)}
                    >
                      {labels.resend}
                    </Button>
                  )}
                  {permissions.canCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onCancel(row.original.id)}
                    >
                      {labels.cancel}
                    </Button>
                  )}
                </div>
              ) : null,
          } satisfies DataTableColumnDef<OrganizationInvitationAdminRow>,
        ]
      : []),
  ];
}
