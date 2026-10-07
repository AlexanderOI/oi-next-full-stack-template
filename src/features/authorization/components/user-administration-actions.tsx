"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { updateUserAccess } from "../actions/manage-user-access";
import { resendUserInvitation } from "../actions/manage-user-invitations";
import { replaceUserRoles } from "../actions/manage-user-roles";
import { authorizationErrorKeys } from "../constants/authorization-error-keys";
import type { RoleSummary } from "../interfaces/role-summary";
import type { UserAccessErrorCode } from "../interfaces/user-access-result";
import type { UserAdministrationPermissions } from "../interfaces/user-administration-permissions";
import type { UserInvitationErrorCode } from "../interfaces/user-invitation-result";
import type { UserRoleSummary } from "../interfaces/user-role-summary";

interface Props {
  actorUserId: string;
  user: UserRoleSummary;
  roles: readonly RoleSummary[];
  permissions: UserAdministrationPermissions;
}

export function UserAdministrationActions({ actorUserId, user, roles, permissions }: Props) {
  const t = useTranslations("authorization.users");
  const common = useTranslations("common");
  const authorizationErrors = useTranslations("authorization.errors");
  const router = useRouter();

  const [dialog, setDialog] = useState<"roles" | "access" | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState([...user.roleIds]);
  const [isPending, startTransition] = useTransition();

  const isInvitationPending = user.invitedAt !== null;
  const accessTarget = user.disabledAt ? "active" : "disabled";
  const canChangeAccess =
    permissions.canManageAccess && !isInvitationPending && user.id !== actorUserId;
  const hasActions =
    permissions.canManageRoles ||
    (permissions.canInviteUsers && isInvitationPending) ||
    canChangeAccess;

  function showAdministrationError(code: UserAccessErrorCode | UserInvitationErrorCode) {
    if (code === "UNAUTHORIZED") {
      toast.error(t("errors.UNAUTHORIZED"));
      return;
    }
    if (code === "FORBIDDEN") {
      toast.error(t("errors.FORBIDDEN"));
      return;
    }
    toast.error(t(`errors.${code}` as never));
  }

  function handleOpenRoles() {
    setSelectedRoleIds([...user.roleIds]);
    setDialog("roles");
  }

  function handleRoleChange(roleId: string, checked: boolean | "indeterminate") {
    setSelectedRoleIds((current) =>
      checked === true ? [...new Set([...current, roleId])] : current.filter((id) => id !== roleId)
    );
  }

  function handleSaveRoles() {
    startTransition(async () => {
      const result = await replaceUserRoles({ userId: user.id, roleIds: selectedRoleIds });
      if (!result.success) {
        toast.error(authorizationErrors(authorizationErrorKeys[result.code] as never));
        return;
      }

      toast.success(t("roles.updated"));
      setDialog(null);
      router.refresh();
    });
  }

  function handleResendInvitation() {
    startTransition(async () => {
      const result = await resendUserInvitation(user.id);
      if (!result.success) {
        showAdministrationError(result.code);
        return;
      }

      toast.success(t("invitation.resent"));
      router.refresh();
    });
  }

  function handleUpdateAccess() {
    startTransition(async () => {
      const result = await updateUserAccess({ userId: user.id, status: accessTarget });
      if (!result.success) {
        showAdministrationError(result.code);
        return;
      }

      toast.success(t(accessTarget === "active" ? "access.reactivated" : "access.disabled"));
      setDialog(null);
      router.refresh();
    });
  }

  if (!hasActions)
    return <span className="text-muted-foreground text-xs">{t("actions.none")}</span>;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("actions.label", { name: user.name })}
              disabled={isPending}
            />
          }
        >
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {permissions.canManageRoles && (
            <DropdownMenuItem onClick={handleOpenRoles}>{t("actions.editRoles")}</DropdownMenuItem>
          )}
          {permissions.canInviteUsers && isInvitationPending && (
            <DropdownMenuItem onClick={handleResendInvitation}>
              {t("actions.resendInvitation")}
            </DropdownMenuItem>
          )}
          {canChangeAccess && (
            <DropdownMenuItem
              variant={accessTarget === "disabled" ? "destructive" : "default"}
              onClick={() => setDialog("access")}
            >
              {t(accessTarget === "disabled" ? "actions.disable" : "actions.reactivate")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "roles"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("roles.title", { name: user.name })}</DialogTitle>
            <DialogDescription>{t("roles.description")}</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-3">
            {roles.map((role) => {
              const id = `user-${user.id}-role-${role.id}`;
              return (
                <Field key={role.id} orientation="horizontal">
                  <Checkbox
                    id={id}
                    checked={selectedRoleIds.includes(role.id)}
                    disabled={isPending}
                    onCheckedChange={(checked) => handleRoleChange(role.id, checked)}
                  />
                  <FieldLabel htmlFor={id}>{role.name}</FieldLabel>
                </Field>
              );
            })}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleSaveRoles}
              disabled={isPending || selectedRoleIds.length === 0}
            >
              {isPending ? common("saving") : t("roles.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "access"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(accessTarget === "disabled" ? "access.disableTitle" : "access.reactivateTitle", {
                name: user.name,
              })}
            </DialogTitle>
            <DialogDescription>
              {t(
                accessTarget === "disabled"
                  ? "access.disableDescription"
                  : "access.reactivateDescription"
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant={accessTarget === "disabled" ? "destructive" : "default"}
              onClick={handleUpdateAccess}
              disabled={isPending}
            >
              {t(
                accessTarget === "disabled" ? "access.confirmDisable" : "access.confirmReactivate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
