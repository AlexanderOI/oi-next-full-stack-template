"use client";

import { Badge } from "@/components/ui/badge";
import {
  DataTableColumnHeader,
  type DataTableColumnDef,
  type DataTableLabels,
} from "@/components/ui/data-table";
import type { RoleSummary } from "../interfaces/role-summary";
import type { UserAdministrationPermissions } from "../interfaces/user-administration-permissions";
import type { UserRoleSummary } from "../interfaces/user-role-summary";
import { UserAdministrationActions } from "./user-administration-actions";

interface Labels {
  name: string;
  username: string;
  roles: string;
  verification: string;
  access: string;
  actions: string;
  usernameMissing: string;
  roleMissing: string;
  invitationPending: string;
  verified: string;
  unverified: string;
  active: string;
  disabled: string;
}

export function createUserAdministrationColumns(input: {
  actorUserId: string;
  roles: readonly RoleSummary[];
  permissions: UserAdministrationPermissions;
  dataTableLabels: DataTableLabels;
  labels: Labels;
}): DataTableColumnDef<UserRoleSummary>[] {
  const roleNames = new Map(input.roles.map((role) => [role.id, role.name]));
  const namesFor = (user: UserRoleSummary) =>
    user.roleIds
      .map((roleId) => roleNames.get(roleId))
      .filter((name): name is string => Boolean(name));

  return [
    {
      id: "search",
      accessorFn: (user) =>
        [user.name, user.email, user.username ?? "", ...namesFor(user)]
          .join(" ")
          .toLocaleLowerCase(),
      filterFn: (row, columnId, value) =>
        String(row.getValue(columnId)).includes(String(value).trim().toLocaleLowerCase()),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "name",
      accessorFn: (user) => user.name,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={input.labels.name}
          labels={input.dataTableLabels}
        />
      ),
      cell: ({ row }) => (
        <div className="min-w-0">
          <span className="block truncate font-medium" title={row.original.name}>
            {row.original.name}
          </span>
          <span className="text-muted-foreground block truncate" title={row.original.email}>
            {row.original.email}
          </span>
        </div>
      ),
    },
    {
      id: "username",
      accessorFn: (user) => user.username ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={input.labels.username}
          labels={input.dataTableLabels}
        />
      ),
      cell: ({ row }) => (
        <span className="block truncate" title={row.original.username ?? undefined}>
          {row.original.username ?? input.labels.usernameMissing}
        </span>
      ),
    },
    {
      id: "roles",
      accessorFn: (user) => namesFor(user).join(", "),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={input.labels.roles}
          labels={input.dataTableLabels}
        />
      ),
      cell: ({ row }) => {
        const names = namesFor(row.original);
        const value = names.join(", ") || input.labels.roleMissing;
        return (
          <span className="block truncate" title={value}>
            {value}
          </span>
        );
      },
    },
    {
      id: "verification",
      accessorFn: (user) =>
        user.invitedAt ? "invited" : user.emailVerified ? "verified" : "unverified",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={input.labels.verification}
          labels={input.dataTableLabels}
        />
      ),
      cell: ({ row }) => {
        const pending = row.original.invitedAt !== null;
        const verified = row.original.emailVerified;
        return (
          <Badge variant={pending || !verified ? "outline" : "secondary"}>
            {pending
              ? input.labels.invitationPending
              : verified
                ? input.labels.verified
                : input.labels.unverified}
          </Badge>
        );
      },
    },
    {
      id: "access",
      accessorFn: (user) => (user.disabledAt ? "disabled" : "active"),
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={input.labels.access}
          labels={input.dataTableLabels}
        />
      ),
      cell: ({ row }) => (
        <Badge variant={row.original.disabledAt ? "destructive" : "secondary"}>
          {row.original.disabledAt ? input.labels.disabled : input.labels.active}
        </Badge>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      enableSorting: false,
      header: input.labels.actions,
      cell: ({ row }) => (
        <UserAdministrationActions
          actorUserId={input.actorUserId}
          user={row.original}
          roles={input.roles}
          permissions={input.permissions}
        />
      ),
    },
  ];
}
