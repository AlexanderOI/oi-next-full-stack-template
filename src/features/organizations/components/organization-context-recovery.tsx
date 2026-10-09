"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { clearInvalidOrganizationContext } from "../actions/clear-invalid-organization-context";

export function OrganizationContextRecovery() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRecover() {
    setError(null);
    startTransition(async () => {
      const result = await clearInvalidOrganizationContext();
      if (result.code === "ORGANIZATION_CONTEXT_INVALIDATED") {
        router.replace(result.href);
        return;
      }
      setError("Unable to refresh the organization context. Try again.");
    });
  }

  return (
    <section
      aria-labelledby="organization-recovery-title"
      className="mx-auto max-w-xl space-y-4 rounded-lg border p-6"
    >
      <h1 id="organization-recovery-title" className="text-xl font-semibold">
        Organization access changed
      </h1>
      <p>
        Your previous organization is no longer available. Return to the organization chooser to
        continue.
      </p>
      <Button type="button" disabled={isPending} onClick={handleRecover}>
        Continue to organizations
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
