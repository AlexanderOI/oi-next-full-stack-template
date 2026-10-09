"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { provisionOrganizationMember } from "../actions/admin-provisioning";
import type { OrganizationProvisioningResult } from "../contracts";

interface Props {
  canCreateRestriction: boolean;
}

export function ProvisionOrganizationMemberDialog({ canCreateRestriction }: Props) {
  const t = useTranslations("organizations.members");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    startTransition(async () => {
      let result: OrganizationProvisioningResult;
      try {
        result = await provisionOrganizationMember({
          name: String(values.get("name") ?? ""),
          email: String(values.get("email") ?? ""),
          username: String(values.get("username") ?? ""),
          locale,
          restricted: canCreateRestriction && restricted,
        });
      } catch {
        setMessage(t("provisionFailed"));
        return;
      }
      if (result.success) {
        setMessage(t("provisionSuccess"));
        router.refresh();
        return;
      }
      setMessage(
        result.code === "INVITATION_DELIVERY_FAILED" ? t("deliveryFailed") : t("provisionFailed")
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>{t("provision")}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("provisionTitle")}</DialogTitle>
          <DialogDescription>{t("provisionDescription")}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="member-name">{t("name")}</Label>
            <Input id="member-name" name="name" required autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-email">{t("email")}</Label>
            <Input id="member-email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-username">{t("username")}</Label>
            <Input id="member-username" name="username" required autoComplete="username" />
          </div>
          {canCreateRestriction && (
            <label className="flex items-center gap-2">
              <Checkbox
                checked={restricted}
                onCheckedChange={(checked) => setRestricted(checked === true)}
              />
              {t("restricted")}
            </label>
          )}
          {message && <p role="status">{message}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? t("pending") : t("submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
