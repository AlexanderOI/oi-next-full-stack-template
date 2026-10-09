"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { updateOrganizationMemberAccess } from "../actions/manage-organization-members";
import type { OrganizationMemberRow } from "../contracts";

interface Props {
  row: OrganizationMemberRow;
}

export function ChangeMembershipAccessControl({ row }: Props) {
  const t = useTranslations("organizations.members");
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const nextStatus = row.status === "active" ? "suspended" : "active";

  function handleChange() {
    startTransition(async () => {
      try {
        const result = await updateOrganizationMemberAccess({
          memberId: row.id,
          status: nextStatus,
        });
        if (result.success) {
          setMessage(
            "identityDisabled" in result.data && result.data.identityDisabled
              ? t("identityRemainsDisabled")
              : t("accessUpdated")
          );
          router.refresh();
        } else {
          setMessage(t("accessUpdateFailed"));
        }
      } catch {
        setMessage(t("accessUpdateFailed"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" disabled={pending} onClick={handleChange}>
        {row.status === "active" ? t("suspend") : t("reactivate")}
      </Button>
      {row.identityDisabled && <span>{t("identityDisabled")}</span>}
      {message && <span role="status">{message}</span>}
    </div>
  );
}
