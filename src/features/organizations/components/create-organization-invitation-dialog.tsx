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
import { Label } from "@/components/ui/label";
import type { OrganizationInvitationRoleOption } from "../interfaces/organization-invitation-admin";
import { createOrganizationInvitation } from "../actions/organization-invitations";

interface Props {
  roles: OrganizationInvitationRoleOption[];
}

export function CreateOrganizationInvitationDialog({ roles }: Props) {
  const t = useTranslations("organizations.invitations");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await createOrganizationInvitation({
          email: String(values.get("email") ?? ""),
          roleId: String(values.get("roleId") ?? ""),
        });
        if (result.success) {
          setMessage(t("createSuccess"));
          router.refresh();
          return;
        }
        if (result.code === "INVITATION_DELIVERY_FAILED") {
          setMessage(t("deliveryFailed"));
          router.refresh();
          return;
        }
        setMessage(t(result.code === "FORBIDDEN" ? "createForbidden" : "createFailed"));
      } catch {
        setMessage(t("createFailed"));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{t("create")}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="invitation-email">{t("email")}</Label>
            <Input id="invitation-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invitation-role">{t("role")}</Label>
            <select
              id="invitation-role"
              name="roleId"
              required
              className="h-9 w-full rounded-md border bg-transparent px-3"
            >
              {roles.map((roleOption) => (
                <option key={roleOption.id} value={roleOption.id}>
                  {roleOption.name}
                </option>
              ))}
            </select>
          </div>
          {message && (
            <p role="status" aria-live="polite">
              {message}
            </p>
          )}
          <Button type="submit" disabled={pending || roles.length === 0}>
            {pending ? t("working") : t("submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
