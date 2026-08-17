"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import type { PermissionSection, RoleSummary } from "../contracts";
import { RoleEditor } from "./role-editor";

export function RoleManager({
  roles,
  permissionOptions,
}: {
  roles: readonly RoleSummary[];
  permissionOptions: readonly PermissionSection[];
}) {
  const t = useTranslations("authorization.roles");
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocusRef = useRef(false);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const filteredRoles = roles.filter(
    ({ name, description }) =>
      name.toLocaleLowerCase().includes(deferredQuery) ||
      description.toLocaleLowerCase().includes(deferredQuery)
  );

  useEffect(() => {
    if (!isCreating && shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      createTriggerRef.current?.focus();
    }
  }, [isCreating]);

  function closeCreateForm() {
    shouldRestoreFocusRef.current = true;
    setIsCreating(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        <Button
          ref={createTriggerRef}
          type="button"
          aria-expanded={isCreating}
          aria-controls="create-role-form"
          onClick={() => setIsCreating((current) => !current)}
        >
          <Plus aria-hidden="true" data-icon="inline-start" />
          {isCreating ? t("closeCreate") : t("create")}
        </Button>
      </PageHeader>

      {isCreating && (
        <section id="create-role-form" aria-label={t("createLabel")}>
          <RoleEditor
            permissionOptions={permissionOptions}
            autoFocus
            onCancel={closeCreateForm}
            onSaved={closeCreateForm}
          />
        </section>
      )}

      <div className="space-y-2">
        <Label htmlFor="role-search">{t("search")}</Label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            id="role-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {t("count", { visible: filteredRoles.length, total: roles.length })}
        </p>
      </div>

      <div className="space-y-3">
        {filteredRoles.length > 0 ? (
          filteredRoles.map((role) => (
            <RoleEditor key={role.id} role={role} permissionOptions={permissionOptions} />
          ))
        ) : (
          <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center">
            {t("empty")}
          </p>
        )}
      </div>
    </div>
  );
}
