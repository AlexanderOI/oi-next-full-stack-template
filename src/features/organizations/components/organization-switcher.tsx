"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ActiveOrganizationOption } from "../contracts";
import { switchOrganization } from "../actions/switch-organization";

interface Props {
  organizations: ActiveOrganizationOption[];
  activeOrganizationId: string;
}

export function OrganizationSwitcher({ organizations, activeOrganizationId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSwitch(organizationId: string) {
    setError(null);
    startTransition(async () => {
      const result = await switchOrganization(organizationId);
      if (!result.success) {
        setError("This organization is no longer available to your account.");
        return;
      }
      router.push(result.href);
    });
  }

  return (
    <section aria-label="Organization switcher" className="mb-6 rounded-lg border p-4">
      <h2 className="font-semibold">Organization</h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {organizations.map((organization) => (
          <li key={organization.id}>
            <Button
              type="button"
              variant={organization.id === activeOrganizationId ? "default" : "outline"}
              aria-current={organization.id === activeOrganizationId ? "true" : undefined}
              disabled={isPending}
              onClick={() => handleSwitch(organization.id)}
            >
              {organization.name}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
