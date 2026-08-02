import { lastLoginMethodClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { env } from "@/config/env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  plugins: [organizationClient(), lastLoginMethodClient()],
});

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
