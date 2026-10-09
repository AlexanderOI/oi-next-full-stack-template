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
import { Input } from "@/components/ui/input";
import { deleteOrganizationAction } from "../actions/delete-organization";

interface Props {
  organizationSlug: string;
}

export function DeleteOrganizationDialog({ organizationSlug }: Props) {
  const t = useTranslations("organizations.deletion");
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const matchesSlug = confirmation === organizationSlug;

  function handleDelete() {
    if (!matchesSlug) return;
    startTransition(async () => {
      try {
        const result = await deleteOrganizationAction({ confirmation });
        if (!result.success) {
          setMessage(t("failed"));
          return;
        }
        if (result.data.sessionCleanupPending) {
          setMessage(t("cleanupPending"));
          router.refresh();
          return;
        }
        router.replace("/org");
      } catch {
        setMessage(t("failed"));
      }
    });
  }

  return (
    <div>
      <Dialog>
        <DialogTrigger render={<Button type="button" variant="destructive" />}>
          {t("open")}
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description", { slug: organizationSlug })}</DialogDescription>
          </DialogHeader>
          <label htmlFor="organization-delete-confirmation">
            {t("confirmLabel", { slug: organizationSlug })}
          </label>
          <Input
            id="organization-delete-confirmation"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <Button
            type="button"
            variant="destructive"
            disabled={!matchesSlug || pending}
            onClick={handleDelete}
          >
            {pending ? t("working") : t("confirm")}
          </Button>
        </DialogContent>
      </Dialog>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
