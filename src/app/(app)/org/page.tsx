import { redirect } from "next/navigation";

import { getCurrentSession } from "@/features/auth/server";
import { OrganizationChooser } from "@/features/organizations/client";
import { getActiveOrganizations } from "@/features/organizations/server";

export default async function OrganizationsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/sign-in");
  const organizations = await getActiveOrganizations(session.user.id);

  return <OrganizationChooser organizations={organizations} />;
}
