"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { OrganizationContext } from "../contracts";
import { switchOrganization } from "../actions/switch-organization";

interface Props {
  target: Pick<OrganizationContext, "organizationId" | "organizationSlug" | "organizationName">;
  active?: Pick<OrganizationContext, "organizationId" | "organizationSlug" | "organizationName">;
}

export function OrganizationContextChoice({ target, active }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSwitch() {
    setError(null);
    startTransition(async () => {
      const result = await switchOrganization(target.organizationId);
      if (!result.success) {
        setError("This organization is no longer available to your account.");
        return;
      }
      router.push(result.href);
    });
  }

  return (
    <section
      aria-labelledby="organization-context-title"
      className="mx-auto max-w-xl space-y-4 rounded-lg border p-6"
    >
      <h1 id="organization-context-title" className="text-xl font-semibold">
        {active ? "Organization context changed" : "Confirm organization"}
      </h1>
      {active ? (
        <p>
          Your active organization is {active.organizationName}. Choose whether to switch to{" "}
          {target.organizationName}.
        </p>
      ) : (
        <p>Choose whether to make {target.organizationName} your active organization.</p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={isPending} onClick={handleSwitch}>
          Switch to {target.organizationName}
        </Button>
        {active ? (
          <Link
            className="border-input rounded-lg border px-3 py-1.5 text-sm"
            href={`/org/${active.organizationSlug}`}
          >
            Go to {active.organizationName}
          </Link>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
