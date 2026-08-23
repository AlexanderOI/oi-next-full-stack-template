"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Info } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteRole, saveRole } from "../actions/manage-roles";
import { authorizationErrorKeys, type PermissionKey, type RoleSummary } from "../contracts";

interface Props {
  role?: RoleSummary;
  permissionOptions: readonly {
    name: string;
    permissions: readonly { key: PermissionKey; name: string; description: string }[];
  }[];
  autoFocus?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function RoleEditor({
  role,
  permissionOptions,
  autoFocus = false,
  onCancel,
  onSaved,
}: Props) {
  const t = useTranslations("authorization.roles");
  const common = useTranslations("common");
  const errors = useTranslations("authorization.errors");

  const [selected, setSelected] = useState<PermissionKey[]>(role ? [...role.permissions] : []);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
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

  function handleRemove() {
    if (!role) return;
    startTransition(async () => {
      const result = await deleteRole(role.id);
      if (result.success) toast.success(t("deleted"));
      else toast.error(errors(authorizationErrorKeys[result.code] as never));
    });
  }

  function handlePermissionChange(permission: PermissionKey, checked: boolean | "indeterminate") {
    setSelected((current) =>
      checked === true
        ? [...current, permission]
        : current.filter((currentPermission) => currentPermission !== permission)
    );
  }

  const form = (
    <form action={handleSubmit} className="p-4">
      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor={`name-${role?.id ?? "new"}`}>{common("name")}</FieldLabel>
          <Input
            id={`name-${role?.id ?? "new"}`}
            name="name"
            defaultValue={role?.name}
            disabled={role?.isSystem}
            autoFocus={autoFocus}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`description-${role?.id ?? "new"}`}>
            {common("description")}
          </FieldLabel>
          <Textarea
            id={`description-${role?.id ?? "new"}`}
            name="description"
            defaultValue={role?.description}
            disabled={role?.isSystem}
          />
        </Field>
        <FieldSet disabled={role?.isSystem || isPending}>
          <FieldLegend variant="label">{common("permissions")}</FieldLegend>
          {permissionOptions.map((section) => (
            <FieldSet key={section.name} className="gap-2">
              <FieldLegend variant="label" className="text-muted-foreground">
                {section.name}
              </FieldLegend>
              <FieldGroup className="grid gap-2 sm:grid-cols-2">
                {section.permissions.map((option) => {
                  const checkboxId = `permission-${role?.id ?? "new"}-${option.key}`;

                  return (
                    <Field
                      key={option.key}
                      orientation="horizontal"
                      className="items-start rounded-md border p-3"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={selected.includes(option.key)}
                        onCheckedChange={(checked) => handlePermissionChange(option.key, checked)}
                      />
                      <FieldContent>
                        <FieldLabel htmlFor={checkboxId}>{option.name}</FieldLabel>
                        <FieldDescription>{option.description}</FieldDescription>
                      </FieldContent>
                    </Field>
                  );
                })}
              </FieldGroup>
            </FieldSet>
          ))}
        </FieldSet>
        {!role?.isSystem && (
          <div className="flex justify-end gap-2">
            {!role && onCancel && (
              <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
                {common("cancel")}
              </Button>
            )}
            {role && (
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={handleRemove}
              >
                {common("delete")}
              </Button>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? common("saving") : t("save")}
            </Button>
          </div>
        )}
      </FieldGroup>
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
