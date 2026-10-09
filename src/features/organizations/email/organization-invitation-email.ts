import "server-only";

import { sendEmail } from "@/services/email/send-email";

interface InvitationEmailInput {
  id: string;
  email: string;
  organizationName: string;
  roleName: string;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

export async function deliverOrganizationInvitation(invitation: InvitationEmailInput) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/invitations/${invitation.id}`;
  const organizationName = escapeHtml(invitation.organizationName);
  const roleName = escapeHtml(invitation.roleName);
  const safeUrl = escapeHtml(url);
  await sendEmail({
    to: invitation.email,
    subject: `Invitation to ${invitation.organizationName}`,
    html: `<p>You have been invited to join <strong>${organizationName}</strong> as ${roleName}.</p><p><a href="${safeUrl}">View invitation</a></p>`,
  });
}
