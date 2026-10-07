import "server-only";

import { randomBytes } from "node:crypto";

const capabilityHeader = "x-oi-nextjs-invitation-capability";
const capability = randomBytes(32).toString("base64url");

export function createTrustedInvitationRequest(url: string) {
  return new Request(url, {
    method: "POST",
    headers: { [capabilityHeader]: capability },
  });
}

export function isTrustedInvitationRequest(request?: Request) {
  return request?.headers.get(capabilityHeader) === capability;
}
