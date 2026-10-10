"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { RecipientInvitationView } from "../contracts";

type ResponseActionResult =
  | { success: true; data: { changed: boolean; invitationId: string } }
  | { success: false; code: string };
type InvitationView = Extract<RecipientInvitationView, { state: "invitation" }>;
type ClientView =
  Exclude<RecipientInvitationView, InvitationView> | Omit<InvitationView, "organizationId">;
type Feedback = "acceptFailed" | "rejectFailed" | "acceptedFeedback" | "rejectedFeedback";

interface Props {
  view: ClientView;
  acceptAction?: () => Promise<ResponseActionResult>;
  rejectAction?: () => Promise<ResponseActionResult>;
}

export function RecipientInvitation({ view, acceptAction, rejectAction }: Props) {
  const t = useTranslations("organizations.recipientInvitation");
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRespond(accept: boolean) {
    if (accept && view.state !== "invitation") return;
    setFeedback(null);
    startTransition(async () => {
      const action = accept ? acceptAction : rejectAction;
      if (!action) return;
      const result = await action();
      if (!result.success) {
        setFeedback(accept ? "acceptFailed" : "rejectFailed");
        return;
      }
      setFeedback(accept ? "acceptedFeedback" : "rejectedFeedback");
      router.refresh();
    });
  }

  if (view.state === "sign-in-required") {
    return (
      <section className="space-y-4" aria-labelledby="recipient-invitation-title">
        <h1 id="recipient-invitation-title">{t("title")}</h1>
        <p>{t("anonymousInstructions")}</p>
        <p>{t("reopenOriginalLink")}</p>
        <nav className="flex gap-4" aria-label={t("accountLinks")}>
          <Link href="/auth/sign-in">{t("signIn")}</Link>
          <Link href="/auth/sign-up">{t("signUp")}</Link>
        </nav>
      </section>
    );
  }

  if (view.state === "verify-email") {
    return (
      <section className="space-y-4" aria-labelledby="recipient-invitation-title">
        <h1 id="recipient-invitation-title">{t("title")}</h1>
        <p>{t("verifyEmailInstructions")}</p>
        <p>{t("reopenOriginalLink")}</p>
        {view.canReject && rejectAction && (
          <Button type="button" disabled={isPending} onClick={() => handleRespond(false)}>
            {t("reject")}
          </Button>
        )}
        {feedback && <p role="status">{t(feedback)}</p>}
      </section>
    );
  }

  if (view.state === "unavailable") {
    return <p role="status">{t("unavailable")}</p>;
  }

  const statusMessageKey = view.status;
  const statusMessage = t(statusMessageKey, {
    expiresAt: new Date(view.expiresAt).toLocaleDateString(),
  });

  return (
    <section className="space-y-4" aria-labelledby="recipient-invitation-title">
      <h1 id="recipient-invitation-title">{t("title")}</h1>
      <p>{t("invitedEmail", { email: view.email })}</p>
      <p>{t("organization", { organization: view.organizationName })}</p>
      <p>{t("role", { role: view.roleName })}</p>
      <p>{statusMessage}</p>
      {view.canAccept && acceptAction && (
        <Button type="button" disabled={isPending} onClick={() => handleRespond(true)}>
          {t("accept")}
        </Button>
      )}
      {view.canReject && rejectAction && (
        <Button type="button" disabled={isPending} onClick={() => handleRespond(false)}>
          {t("reject")}
        </Button>
      )}
      {view.showSwitch && (
        <div className="space-y-2">
          <p>{t("switchPrompt", { activeOrganization: view.activeOrganizationName ?? "" })}</p>
          <Link href="/org">{t("goToOrganizationSelector")}</Link>
        </div>
      )}
      {feedback && <p role="status">{t(feedback)}</p>}
    </section>
  );
}
