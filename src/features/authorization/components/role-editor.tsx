"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteRole, saveRole } from "../actions/manage-roles";
import { authorizationErrorKeys, type PermissionKey, type RoleSummary } from "../contracts";

export function RoleEditor({
  role,
  permissionOptions,
  autoFocus = false,
  onCancel,
  onSaved,
}: {
  role?: RoleSummary;
  permissionOptions: readonly {
    name: string;
    permissions: readonly { key: PermissionKey; name: string; description: string }[];
  }[];
  autoFocus?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("authorization.roles");
  const common = useTranslations("common");
  const errors = useTranslations("authorization.errors");
  const [selected, setSelected] = useState<PermissionKey[]>(role ? [...role.permissions] : []);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveRole({
        id: role?.id,
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        permissions: selected,
      });
      if (result.success) {
        toast.success(t("saved"));
        onSaved?.();
      } else toast.error(errors(authorizationErrorKeys[result.code] as never));
    });
  }

  function remove() {
    if (!role) return;
    startTransition(async () => {
      const result = await deleteRole(role.id);
      if (result.success) toast.success(t("deleted"));
      else toast.error(errors(authorizationErrorKeys[result.code] as never));
    });
  }

  const form = (
    <form action={submit} className="space-y-4 p-4">
      <div className="space-y-2">
        <Label htmlFor={`name-${role?.id ?? "new"}`}>{common("name")}</Label>
        <Input
          id={`name-${role?.id ?? "new"}`}
          name="name"
          defaultValue={role?.name}
          disabled={role?.isSystem}
          autoFocus={autoFocus}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`description-${role?.id ?? "new"}`}>{common("description")}</Label>
        <Textarea
          id={`description-${role?.id ?? "new"}`}
          name="description"
          defaultValue={role?.description}
          disabled={role?.isSystem}
        />
      </div>
      <fieldset disabled={role?.isSystem || isPending} className="space-y-4">
        <legend className="mb-2 text-sm font-medium">{common("permissions")}</legend>
        {permissionOptions.map((section) => (
          <fieldset key={section.name} className="space-y-2">
            <legend className="text-muted-foreground text-sm font-medium">{section.name}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {section.permissions.map((option) => (
                <Label key={option.key} className="items-start rounded-md border p-3">
                  <Checkbox
                    checked={selected.includes(option.key)}
                    onCheckedChange={(checked) =>
                      setSelected((current) =>
                        checked
                          ? [...current, option.key]
                          : current.filter((key) => key !== option.key)
                      )
                    }
                  />
                  <span>
                    <span className="block font-medium">{option.name}</span>
                    <span className="text-muted-foreground font-normal">{option.description}</span>
                  </span>
                </Label>
              ))}
            </div>
          </fieldset>
        ))}
      </fieldset>
      {!role?.isSystem && (
        <div className="flex justify-end gap-2">
          {!role && onCancel && (
            <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
              {common("cancel")}
            </Button>
          )}
          {role && (
            <Button type="button" variant="destructive" disabled={isPending} onClick={remove}>
              {common("delete")}
            </Button>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? common("saving") : t("save")}
          </Button>
        </div>
      )}
    </form>
  );

  if (!role) return <div className="rounded-lg border">{form}</div>;

  return (
    <details
      className={`group rounded-lg border ${role.isSystem ? "border-blue-500/30 bg-blue-500/5" : ""}`}
    >
      <summary
        tabIndex={0}
        className="focus-visible:ring-ring flex cursor-pointer list-none items-center gap-3 rounded-lg p-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
      >
        {role.isSystem && <Info aria-hidden="true" className="size-4 shrink-0 text-blue-500" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{role.name}</span>
          <span className="text-muted-foreground block text-sm">
            {t("permissionCount", { count: role.permissions.length })}
          </span>
        </span>
        {role.isSystem && (
          <Badge variant="secondary">
            <Info aria-hidden="true" data-icon="inline-start" />
            {t("managed")}
          </Badge>
        )}
        <ChevronDown
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      {role.isSystem && (
        <p className="text-muted-foreground border-t px-4 pt-4 text-sm">
          {t("managedDescription")}
        </p>
      )}
      {form}
    </details>
  );
}
