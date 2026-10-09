"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { switchOrganization } from "../actions/switch-organization";

interface Props {
  organizations: { id: string; slug: string; name: string }[];
  activeOrganizationId: string | null;
}

export function OrganizationHeaderSelector({ organizations, activeOrganizationId }: Props) {
  const router = useRouter();
  const t = useTranslations("shell");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const selected = organizations.some(({ id }) => id === activeOrganizationId)
    ? activeOrganizationId
    : null;

  function handleSelect(id: string | null) {
    if (!id || id === selected) return;
    setError(false);
    startTransition(async () => {
      try {
        const result = await switchOrganization(id);
        if (result.success) router.push(result.href);
        else setError(true);
      } catch {
        setError(true);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selected}
        onValueChange={handleSelect}
        disabled={pending || organizations.length === 0}
      >
        <SelectTrigger aria-label={t("selectOrganization")} size="sm">
          <SelectValue placeholder={pending ? t("switchingOrganization") : t("selectOrganization")}>
            {organizations.find(({ id }) => id === selected)?.name}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {organizations.map((organization) => (
            <SelectItem key={organization.id} value={organization.id}>
              {organization.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <span role="alert" className="text-destructive text-xs">
          {t("organizationUnavailable")}
        </span>
      )}
    </div>
  );
}
