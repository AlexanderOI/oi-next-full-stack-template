import "server-only";

import { listActiveOrganizations } from "../data/list-active-organizations";

export async function getActiveOrganizations(userId: string) {
  return listActiveOrganizations(userId);
}
