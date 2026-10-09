"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { ActiveOrganizationOption } from "../contracts";
import { switchOrganization } from "../actions/switch-organization";

interface Props {
  organizations: ActiveOrganizationOption[];
}

export function OrganizationChooser({ organizations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChoose(organizationId: string) {
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

  if (organizations.length === 0) {
    return (
      <section className="mx-auto max-w-xl space-y-2 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">No organization access</h1>
        <p>You do not have an active organization membership yet.</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="organization-chooser-title"
      className="mx-auto max-w-xl space-y-4 rounded-lg border p-6"
    >
      <div>
        <h1 id="organization-chooser-title" className="text-xl font-semibold">
          Choose an organization
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Select one to make it active for this session.
        </p>
      </div>
      <ul className="space-y-2">
        {organizations.map((organization) => (
          <li key={organization.id}>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleChoose(organization.id)}
            >
              {organization.name}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
