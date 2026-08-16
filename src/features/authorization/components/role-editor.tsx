"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteRole, saveRole } from "../actions/manage-roles";
import type { PermissionKey, RoleSummary } from "../contracts";

export function RoleEditor({
  role,
  permissionOptions,
}: {
  role?: RoleSummary;
  permissionOptions: readonly { key: PermissionKey; description: string }[];
}) {
  const [selected, setSelected] = useState<PermissionKey[]>(role ? [...role.permissions] : []);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveRole({
        id: role?.id,
        key: String(formData.get("key") ?? ""),
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        permissions: selected,
      });
      if (result.success) toast.success("Role saved");
      else toast.error(result.error);
    });
  }

  function remove() {
    if (!role) return;
    startTransition(async () => {
      const result = await deleteRole(role.id);
      if (result.success) toast.success("Role deleted");
      else toast.error(result.error);
    });
  }

  return (
    <form action={submit} className="space-y-4 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`key-${role?.id ?? "new"}`}>Key</Label>
          <Input
            id={`key-${role?.id ?? "new"}`}
            name="key"
            defaultValue={role?.key}
            disabled={role?.isSystem}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`name-${role?.id ?? "new"}`}>Name</Label>
          <Input
            id={`name-${role?.id ?? "new"}`}
            name="name"
            defaultValue={role?.name}
            disabled={role?.isSystem}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`description-${role?.id ?? "new"}`}>Description</Label>
        <Textarea
          id={`description-${role?.id ?? "new"}`}
          name="description"
          defaultValue={role?.description}
          disabled={role?.isSystem}
        />
      </div>
      <fieldset disabled={role?.isSystem || isPending} className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Permissions</legend>
        {permissionOptions.map((option) => (
          <Label key={option.key} className="items-start rounded-md border p-3">
            <Checkbox
              checked={selected.includes(option.key)}
              onCheckedChange={(checked) =>
                setSelected((current) =>
                  checked ? [...current, option.key] : current.filter((key) => key !== option.key)
                )
              }
            />
            <span>
              <span className="block font-medium">{option.key}</span>
              <span className="text-muted-foreground font-normal">{option.description}</span>
            </span>
          </Label>
        ))}
      </fieldset>
      {!role?.isSystem && (
        <div className="flex justify-end gap-2">
          {role && (
            <Button type="button" variant="destructive" disabled={isPending} onClick={remove}>
              Delete
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save role"}
          </Button>
        </div>
      )}
    </form>
  );
}
