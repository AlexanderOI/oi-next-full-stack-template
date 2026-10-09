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
import {
  leaveOrganization,
  removeOrganizationMember,
} from "../actions/manage-organization-members";
import type { OrganizationMemberRow } from "../contracts";

interface Props {
  row: OrganizationMemberRow;
  self: boolean;
}

export function RemoveOrganizationMemberDialog({ row, self }: Props) {
  const t = useTranslations("organizations.members");
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      try {
        const result = self
          ? await leaveOrganization()
          : await removeOrganizationMember({ memberId: row.id });
        if (!result.success) {
          setMessage(t("removeFailed"));
          return;
        }
        if (self && "identityDeleted" in result.data && result.data.identityDeleted) {
          setMessage(t("identityDeletedFeedback"));
          router.replace("/auth/sign-in?accountRemoved=1");
          return;
        }
        setMessage(self ? t("leaveSuccess") : t("removeSuccess"));
        router.refresh();
      } catch {
        setMessage(t("removeFailed"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Dialog>
        <DialogTrigger render={<Button type="button" variant="outline" disabled={pending} />}>
          {self ? t("leave") : t("remove")}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{self ? t("leaveTitle") : t("removeTitle")}</DialogTitle>
            <DialogDescription>
              {self ? t("leaveDescription") : t("removeDescription")}
            </DialogDescription>
          </DialogHeader>
          <Button type="button" disabled={pending} onClick={handleRemove}>
            {pending ? t("pending") : self ? t("leave") : t("remove")}
          </Button>
        </DialogContent>
      </Dialog>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
