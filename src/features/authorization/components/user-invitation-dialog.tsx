"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";
import { inviteUser } from "../actions/manage-user-invitations";

interface Props {
  canInviteUsers: boolean;
}

export function UserInvitationDialog({ canInviteUsers }: Props) {
  const t = useTranslations("authorization.users");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await inviteUser({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        username: String(data.get("username") ?? ""),
        locale,
      });

      if (!result.success) {
        if (result.code === "UNAUTHORIZED") toast.error(t("errors.UNAUTHORIZED"));
        else if (result.code === "FORBIDDEN") toast.error(t("errors.FORBIDDEN"));
        else toast.error(t(`errors.${result.code}` as never));
        return;
      }

      toast.success(t("invitation.sent"));
      form.reset();
      setOpen(false);
      router.refresh();
    });
  }

  if (!canInviteUsers) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" />}>{t("invitation.open")}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("invitation.title")}</DialogTitle>
          <DialogDescription>{t("invitation.description")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-user-name">{t("invitation.name")}</FieldLabel>
              <Input id="invite-user-name" name="name" autoComplete="name" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-user-email">{t("invitation.email")}</FieldLabel>
              <Input
                id="invite-user-email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="invite-user-username">{t("invitation.username")}</FieldLabel>
              <Input id="invite-user-username" name="username" autoComplete="username" required />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("invitation.sending") : t("invitation.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
