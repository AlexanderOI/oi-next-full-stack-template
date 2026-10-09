import "server-only";

import { randomBytes } from "node:crypto";

import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { organization, username } from "better-auth/plugins";

import { headers } from "next/headers";
import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/drizzle";
import {
  member,
  platformRoleAssignment,
  role,
  schema,
  session as sessionTable,
  user,
} from "@/db/schema";
import { sendLocalizedPasswordResetEmail } from "./email/password-reset-email-delivery";
import { sendLocalizedVerificationEmail } from "./email/verification-email-delivery";
import {
  AUTH_NONRESTRICTIVE_INVITATION_LIMIT,
  AUTH_NONRESTRICTIVE_MEMBERSHIP_LIMIT,
  MAX_ORGANIZATIONS_PER_USER,
  ORGANIZATION_INVITATION_LIFETIME_DAYS,
} from "@/features/organizations/contracts";
import {
  createTrustedInvitationRequest,
  isTrustedInvitationRequest,
} from "./lib/invitation-capability";
import { organizationRouteGuard } from "./lib/organization-route-guard";
import {
  compensateFailedPublicSignup,
  compensateFailedTrustedSignup,
  completePublicSignup,
} from "@/features/organizations/server";

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
    sendOnSignUp: false,
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
      initialActiveOrganizationId: {
        type: "string",
        required: false,
        input: false,
        returned: false,
      },
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
        after: async (createdUser, context) => {
          try {
            const [memberRole] = await db
              .select({ id: role.id })
              .from(role)
              .where(and(eq(role.key, "member"), eq(role.scope, "platform")))
              .limit(1);

            if (!memberRole) {
              throw new Error("The member role has not been bootstrapped");
            }

            await db
              .insert(platformRoleAssignment)
              .values({ userId: createdUser.id, roleId: memberRole.id, assignedByUserId: null })
              .onConflictDoNothing();
          } catch (error) {
            const compensate = isTrustedInvitationRequest(context?.request)
              ? compensateFailedTrustedSignup
              : compensateFailedPublicSignup;
            try {
              await compensate(createdUser.id);
            } catch (cleanupError) {
              throw new AggregateError(
                [error, cleanupError],
                "Identity creation setup failed and transactional compensation failed",
                { cause: error }
              );
            }
            throw error;
          }

          if (isTrustedInvitationRequest(context?.request)) return;

          try {
            await completePublicSignup(
              createdUser.id,
              typeof createdUser.username === "string" ? createdUser.username : "",
              createdUser.name
            );
          } catch (error) {
            try {
              await compensateFailedPublicSignup(createdUser.id);
            } catch (cleanupError) {
              throw new AggregateError(
                [error, cleanupError],
                "Public signup setup failed and transactional compensation failed",
                { cause: error }
              );
            }
            throw error;
          }

          try {
            await auth.api.sendVerificationEmail({
              body: { email: createdUser.email },
              request: context?.request ?? undefined,
            });
          } catch {
            console.error("Public signup verification delivery failed");
          }
        },
      },
    },
    session: {
      create: {
        before: async (createdSession) => {
          if (await isUserDisabled(createdSession.userId)) return false;

          const [onboarding] = await db
            .select({
              initialActiveOrganizationId: user.initialActiveOrganizationId,
              emailVerified: user.emailVerified,
            })
            .from(user)
            .where(eq(user.id, createdSession.userId))
            .limit(1);

          if (!onboarding?.initialActiveOrganizationId || !onboarding.emailVerified) return;

          const [activeMembership] = await db
            .select({ id: member.id })
            .from(member)
            .where(
              and(
                eq(member.organizationId, onboarding.initialActiveOrganizationId),
                eq(member.userId, createdSession.userId),
                eq(member.status, "active")
              )
            )
            .limit(1);

          if (!activeMembership) return;

          return {
            data: { activeOrganizationId: onboarding.initialActiveOrganizationId },
          };
        },
      },
    },
  },
  disabledPaths: ["/organization/accept-invitation", "/organization/delete"],
  hooks: {
    before: createAuthMiddleware(organizationRouteGuard),
  },
  plugins: [
    nextCookies(),
    username(),
    organization({
      organizationLimit: MAX_ORGANIZATIONS_PER_USER,
      invitationExpiresIn: ORGANIZATION_INVITATION_LIFETIME_DAYS * 24 * 60 * 60,
      cancelPendingInvitationsOnReInvite: true,
      membershipLimit: AUTH_NONRESTRICTIVE_MEMBERSHIP_LIMIT,
      invitationLimit: AUTH_NONRESTRICTIVE_INVITATION_LIMIT,
      disableOrganizationDeletion: true,
      schema: {
        organization: {
          additionalFields: {
            personalSignupOwnerUserId: {
              type: "string",
              required: false,
              input: false,
              returned: false,
            },
          },
        },
      },
    }),
  ],
});

export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSession = typeof auth.$Infer.Session;

export async function getCurrentSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session || (await isUserDisabled(session.user.id))) return null;

  const [onboarding] = await db
    .select({ initialActiveOrganizationId: user.initialActiveOrganizationId })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  const initialOrganizationId = onboarding?.initialActiveOrganizationId;

  if (initialOrganizationId && session.session.activeOrganizationId === initialOrganizationId) {
    const [persistedSession] = await db
      .select({ id: sessionTable.id })
      .from(sessionTable)
      .where(
        and(
          eq(sessionTable.id, session.session.id),
          eq(sessionTable.userId, session.user.id),
          eq(sessionTable.activeOrganizationId, initialOrganizationId)
        )
      )
      .limit(1);

    if (persistedSession) {
      await db
        .update(user)
        .set({ initialActiveOrganizationId: null })
        .where(
          and(
            eq(user.id, session.user.id),
            eq(user.initialActiveOrganizationId, initialOrganizationId)
          )
        );
    }
  }

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
