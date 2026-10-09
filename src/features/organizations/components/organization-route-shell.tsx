import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";

import { getActiveOrganizations } from "../lib/list-current-active-organizations";
import { resolveOrganizationContext } from "../lib/resolve-organization-context";
import { OrganizationContextChoice } from "./organization-context-choice";
import { OrganizationContextRecovery } from "./organization-context-recovery";
import { OrganizationSwitcher } from "./organization-switcher";
import type { OrganizationSessionContext } from "../interfaces/organization-session-context";

interface Props {
  organizationSlug: string;
  session: OrganizationSessionContext | null;
  children: ReactNode;
}

export async function OrganizationRouteShell({ organizationSlug, session, children }: Props) {
  const result = await resolveOrganizationContext(organizationSlug, session);

  if (result.ok) {
    const organizations = await getActiveOrganizations(result.context.userId);
    if (!organizations?.some(({ id }) => id === result.context.organizationId)) {
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
