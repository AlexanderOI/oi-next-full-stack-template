"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { transferOrganizationOwnership } from "../actions/manage-organization-members";
import type { OrganizationMemberRow } from "../contracts";

interface Props {
  rows: OrganizationMemberRow[];
  actorMembershipId: string;
}

export function TransferOrganizationOwnershipDialog({ rows, actorMembershipId }: Props) {
  const t = useTranslations("organizations.members");
  const router = useRouter();
  const [recipientMemberId, setRecipientMemberId] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const candidates = rows.filter((row) => row.status === "active" && row.id !== actorMembershipId);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recipientMemberId) return;
    startTransition(async () => {
      try {
        const result = await transferOrganizationOwnership({ recipientMemberId });
        setMessage(result.success ? t("transferSuccess") : t("transferFailed"));
        if (result.success) router.refresh();
      } catch {
        setMessage(t("transferFailed"));
      }
    });
  }

  if (candidates.length === 0) return null;
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        {t("transfer")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("transferTitle")}</DialogTitle>
          <DialogDescription>{t("transferDescription")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span>{t("transferRecipient")}</span>
            <select
              aria-label={t("transferRecipient")}
              required
              value={recipientMemberId}
              onChange={(event) => setRecipientMemberId(event.currentTarget.value)}
            >
              <option value="">{t("transferChooseRecipient")}</option>
              {candidates.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} ({row.email})
                </option>
              ))}
            </select>
          </label>
          {message && <p role="status">{message}</p>}
          <Button type="submit" disabled={pending || !recipientMemberId}>
            {pending ? t("pending") : t("transferConfirm")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
