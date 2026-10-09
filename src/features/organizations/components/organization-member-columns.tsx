"use client";

import type { DataTableColumnDef } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import type { OrganizationMemberRow } from "../interfaces/organization-member";
import { ChangeMembershipAccessControl } from "./change-membership-access-dialog";
import { RemoveOrganizationMemberDialog } from "./remove-organization-member-dialog";

export interface OrganizationMemberColumnLabels {
  name: string;
  email: string;
  username: string;
  status: string;
  statusActive: string;
  statusSuspended: string;
  roles: string;
  created: string;
  activation: string;
  pending: string;
  activated: string;
  resend: string;
  identityDisabled: string;
}

export function createOrganizationMemberColumns(
  labels: OrganizationMemberColumnLabels,
  onResend: (userId: string) => void,
  canResend: boolean,
  canManageAccess = false,
  canRemoveMembers = false,
  actorUserId = ""
): DataTableColumnDef<OrganizationMemberRow>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.name} />,
    },
    {
      accessorKey: "email",
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.email} />,
    },
    {
      accessorKey: "username",
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.username} />,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.status} />,
      cell: ({ row }) => (
        <span>
          {labels[row.original.status === "active" ? "statusActive" : "statusSuspended"]}
          {row.original.identityDisabled ? ` · ${labels.identityDisabled}` : ""}
        </span>
      ),
    },
    {
      id: "roles",
      enableSorting: false,
      accessorFn: (row) => row.roles.map(({ name }) => name).join(", "),
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.roles} />,
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.created} />,
      cell: ({ row }) => row.original.createdAt.toLocaleDateString(),
    },
    {
      id: "activation",
      enableSorting: false,
      accessorFn: (row) => row.activationState,
      header: ({ column }) => <DataTableColumnHeader column={column} title={labels.activation} />,
      cell: ({ row }) =>
        labels[row.original.activationState === "pending" ? "pending" : "activated"],
    },
    ...(canResend || canManageAccess || canRemoveMembers || actorUserId
      ? [
          {
            id: "actions",
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => (
              <div className="flex flex-wrap items-center gap-2">
                {row.original.status === "active" && row.original.activationState === "pending" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onResend(row.original.userId)}
                  >
                    {labels.resend}
                  </Button>
                )}
                {canManageAccess && <ChangeMembershipAccessControl row={row.original} />}
                {(row.original.userId === actorUserId || canRemoveMembers) && (
                  <RemoveOrganizationMemberDialog
                    row={row.original}
                    self={row.original.userId === actorUserId}
                  />
                )}
              </div>
            ),
          } satisfies DataTableColumnDef<OrganizationMemberRow>,
        ]
      : []),
  ];
}
