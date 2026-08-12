import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";

import { db } from "@/db/drizzle";
import { schema } from "@/db/schema";
import { accountVerificationEmail, emailChangeVerificationEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/mailer";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }, request) {
      const isEmailChange = request
        ? new URL(request.url).pathname.endsWith("/change-email")
        : false;

      await sendEmail({
        to: user.email,
        subject: isEmailChange ? "Confirm your new email" : "Verify your account",
        html: isEmailChange
          ? emailChangeVerificationEmail({ name: user.name, url })
          : accountVerificationEmail({ name: user.name, url }),
      });
    },
  },
  user: {
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: false,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [nextCookies(), username()],
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session;
