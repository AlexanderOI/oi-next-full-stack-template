import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { role, schema, userRole } from "@/db/schema";
import { sendLocalizedVerificationEmail } from "./email/verification-email-delivery";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }, request) {
      await sendLocalizedVerificationEmail(user, url, request);
    },
  },
  user: {
    additionalFields: {
      locale: { type: "string", required: false, input: false },
    },
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          const [memberRole] = await db
            .select({ id: role.id })
            .from(role)
            .where(eq(role.key, "member"))
            .limit(1);

          if (!memberRole) {
            throw new Error("The member role has not been bootstrapped");
          }

          await db
            .insert(userRole)
            .values({ userId: createdUser.id, roleId: memberRole.id })
            .onConflictDoNothing();
        },
      },
    },
  },
  plugins: [nextCookies(), username()],
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session;

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
