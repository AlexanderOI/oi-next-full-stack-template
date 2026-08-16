"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { replaceUserRoles } from "../actions/manage-user-roles";
import type { RoleSummary, UserRoleSummary } from "../contracts";

export function UserRoleAssignment({
  user,
  roles,
}: {
  user: UserRoleSummary;
  roles: readonly RoleSummary[];
}) {
  const [selected, setSelected] = useState([...user.roleIds]);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">{user.name}</h2>
        <p className="text-muted-foreground text-sm">{user.email}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {roles.map((role) => (
          <Label key={role.id}>
            <Checkbox
              checked={selected.includes(role.id)}
              disabled={isPending}
              onCheckedChange={(checked) =>
                setSelected((current) =>
                  checked ? [...current, role.id] : current.filter((id) => id !== role.id)
                )
              }
            />
            {role.name}
          </Label>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        disabled={isPending || selected.length === 0}
        onClick={() =>
          startTransition(async () => {
            const result = await replaceUserRoles({ userId: user.id, roleIds: selected });
            if (result.success) toast.success("Roles updated");
            else toast.error(result.error);
          })
        }
      >
        {isPending ? "Saving..." : "Save assignments"}
      </Button>
    </section>
  );
}
