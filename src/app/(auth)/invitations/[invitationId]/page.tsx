import { getCurrentSession } from "@/features/auth/server";
import { RecipientInvitation } from "@/features/organizations/client";
import {
  acceptOrganizationInvitationAction,
  getRecipientInvitation,
  rejectOrganizationInvitationAction,
} from "@/features/organizations/server";

interface Props {
  params: Promise<{ invitationId: string }>;
}

export default async function RecipientInvitationPage({ params }: Props) {
  const [{ invitationId }, session] = await Promise.all([params, getCurrentSession()]);
  const view = await getRecipientInvitation(invitationId, session);
  if (view.state !== "invitation") {
    return (
      <RecipientInvitation
        view={view}
        rejectAction={
          view.state === "verify-email" && view.canReject
            ? rejectOrganizationInvitationAction.bind(null, { invitationId })
            : undefined
        }
      />
    );
  }

  const { organizationId: _organizationId, ...clientView } = view;
  void _organizationId;
  return (
    <RecipientInvitation
      view={clientView}
      acceptAction={
        view.canAccept ? acceptOrganizationInvitationAction.bind(null, { invitationId }) : undefined
      }
      rejectAction={
        view.canReject ? rejectOrganizationInvitationAction.bind(null, { invitationId }) : undefined
      }
    />
  );
}
