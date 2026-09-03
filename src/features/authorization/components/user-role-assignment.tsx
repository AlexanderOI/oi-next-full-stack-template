"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { replaceUserRoles } from "../actions/manage-user-roles";
import { authorizationErrorKeys } from "../constants/authorization-error-keys";
import type { RoleSummary } from "../interfaces/role-summary";
import type { UserRoleSummary } from "../interfaces/user-role-summary";

interface Props {
  user: UserRoleSummary;
  roles: readonly RoleSummary[];
}

export function UserRoleAssignment({ user, roles }: Props) {
  const t = useTranslations("authorization.users");
  const common = useTranslations("common");
  const errors = useTranslations("authorization.errors");

  const [selected, setSelected] = useState([...user.roleIds]);
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(roleId: string, checked: boolean | "indeterminate") {
    setSelected((current) =>
      checked === true ? [...current, roleId] : current.filter((id) => id !== roleId)
    );
  }

  function handleSaveAssignments() {
    startTransition(async () => {
      const result = await replaceUserRoles({ userId: user.id, roleIds: selected });
      if (result.success) toast.success(t("updated"));
      else toast.error(errors(authorizationErrorKeys[result.code] as never));
    });
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">{user.name}</h2>
        <p className="text-muted-foreground text-sm">{user.email}</p>
      </div>
      <FieldGroup className="flex-row flex-wrap gap-3">
        {roles.map((role) => {
          const checkboxId = `user-${user.id}-role-${role.id}`;

          return (
            <Field key={role.id} orientation="horizontal" className="w-auto">
              <Checkbox
                id={checkboxId}
                checked={selected.includes(role.id)}
                disabled={isPending}
                onCheckedChange={(checked) => handleRoleChange(role.id, checked)}
              />
              <FieldLabel htmlFor={checkboxId}>{role.name}</FieldLabel>
            </Field>
          );
        })}
      </FieldGroup>
      <Button
        type="button"
        size="sm"
        disabled={isPending || selected.length === 0}
        onClick={handleSaveAssignments}
      >
        {isPending ? common("saving") : t("saveAssignments")}
      </Button>
    </section>
  );
}
