import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { getCurrentSession } from "@/features/auth/server";
import {
  OrganizationContextChoice,
  OrganizationContextRecovery,
  OrganizationSwitcher,
} from "@/features/organizations/client";
import {
  getActiveOrganizations,
  resolveOrganizationContext,
} from "@/features/organizations/server";

interface Props {
  children: ReactNode;
  params: Promise<{ organizationSlug: string }>;
}

export default async function OrganizationLayout({ children, params }: Props) {
  const [{ organizationSlug }, current] = await Promise.all([params, getCurrentSession()]);
  const session = current
    ? {
        user: { id: current.user.id },
        session: {
          id: current.session.id,
          activeOrganizationId: current.session.activeOrganizationId ?? null,
        },
      }
    : null;
  const result = await resolveOrganizationContext(organizationSlug, session);

  if (result.ok) {
    const organizations = await getActiveOrganizations(result.context.userId);
    if (!organizations.some(({ id }) => id === result.context.organizationId)) {
      return <OrganizationContextRecovery />;
    }

    return (
      <div>
        <OrganizationSwitcher
          organizations={organizations}
          activeOrganizationId={result.context.organizationId}
        />
        <h1 className="mb-4 text-2xl font-semibold">{result.context.organizationName}</h1>
        {children}
      </div>
    );
  }

  switch (result.error) {
    case "FORBIDDEN":
      return redirect("/auth/sign-in");
    case "ORGANIZATION_CONTEXT_INVALIDATED":
      return <OrganizationContextRecovery />;
    case "ORGANIZATION_CONTEXT_REQUIRED":
      return <OrganizationContextChoice target={result.target} />;
    case "ORGANIZATION_CONTEXT_MISMATCH":
      return <OrganizationContextChoice target={result.target} active={result.active} />;
    default:
      notFound();
  }
}
