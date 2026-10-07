import "server-only";

import { randomBytes } from "node:crypto";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";

import { headers } from "next/headers";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/drizzle";
import { role, schema, user, userRole } from "@/db/schema";
import { sendLocalizedPasswordResetEmail } from "./email/password-reset-email-delivery";
import { sendLocalizedVerificationEmail } from "./email/verification-email-delivery";
import {
  createTrustedInvitationRequest,
  isTrustedInvitationRequest,
} from "./lib/invitation-capability";

const invitationDeliveryReceiptHeader = "x-oi-nextjs-invitation-delivery-receipt";
const invitationDeliveryTimeoutMs = 10_000;

type InvitationDeliveryOutcome = "delivered" | "failed";

interface InvitationDeliveryReceipt {
  outcome: Promise<InvitationDeliveryOutcome>;
  settle: (outcome: InvitationDeliveryOutcome) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const invitationDeliveryReceipts = new Map<string, InvitationDeliveryReceipt>();

function createInvitationDeliveryReceipt() {
  const id = randomBytes(32).toString("base64url");
  let settleOutcome!: (outcome: InvitationDeliveryOutcome) => void;
  const outcome = new Promise<InvitationDeliveryOutcome>((resolve) => {
    settleOutcome = resolve;
  });
  const receipt: InvitationDeliveryReceipt = {
    outcome,
    settle: settleOutcome,
    timeout: setTimeout(() => settleInvitationDelivery(id, "failed"), invitationDeliveryTimeoutMs),
  };

  invitationDeliveryReceipts.set(id, receipt);
  return { id, outcome };
}

function settleInvitationDelivery(id: string, outcome: InvitationDeliveryOutcome) {
  const receipt = invitationDeliveryReceipts.get(id);
  if (!receipt) return;

  invitationDeliveryReceipts.delete(id);
  clearTimeout(receipt.timeout);
  receipt.settle(outcome);
}

function getInvitationDeliveryReceiptId(request?: Request) {
  const id = request?.headers.get(invitationDeliveryReceiptHeader);
  return id && invitationDeliveryReceipts.has(id) ? id : null;
}

async function isUserDisabled(userId: string) {
  const [accessState] = await db
    .select({ disabledAt: user.disabledAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  return !accessState || Boolean(accessState.disabledAt);
}

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }, request) {
      const receiptId = getInvitationDeliveryReceiptId(request);

      try {
        await sendLocalizedPasswordResetEmail(user, url, request);
        if (receiptId) settleInvitationDelivery(receiptId, "delivered");
      } catch (error) {
        if (receiptId) settleInvitationDelivery(receiptId, "failed");
        throw error;
      }
    },
    async onPasswordReset({ user: resetUser }) {
      await db
        .update(user)
        .set({ emailVerified: true, invitedAt: null })
        .where(and(eq(user.id, resetUser.id), isNotNull(user.invitedAt)));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }, request) {
      if (isTrustedInvitationRequest(request)) return;
      await sendLocalizedVerificationEmail(user, url, request);
    },
  },
  user: {
    additionalFields: {
      locale: { type: "string", required: false, input: false },
      invitedAt: { type: "date", required: false, input: false },
      disabledAt: { type: "date", required: false, input: false },
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
    session: {
      create: {
        before: async (createdSession) => {
          if (await isUserDisabled(createdSession.userId)) return false;
        },
      },
    },
  },
  plugins: [nextCookies(), username()],
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session;

export async function getCurrentSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session || (await isUserDisabled(session.user.id))) return null;
  return session;
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requestInvitationPasswordReset(email: string, redirectTo: string) {
  const receipt = createInvitationDeliveryReceipt();

  try {
    const result = await auth.api.requestPasswordReset({
      body: { email, redirectTo },
      request: new Request("http://localhost/api/auth/request-password-reset", {
        method: "POST",
        headers: { [invitationDeliveryReceiptHeader]: receipt.id },
      }),
    });
    if (!result.status) throw new Error("INVITATION_DELIVERY_FAILED");

    const outcome = await receipt.outcome;
    if (outcome !== "delivered") throw new Error("INVITATION_DELIVERY_FAILED");
  } finally {
    settleInvitationDelivery(receipt.id, "failed");
  }
}

export { createTrustedInvitationRequest };
