"use server";

import { randomBytes } from "node:crypto";

import { and, eq, isNotNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db/drizzle";
import { user } from "@/db/schema";
import {
  auth,
  createTrustedInvitationRequest,
  requestInvitationPasswordReset,
} from "@/features/auth/server";
import { getFieldErrors } from "@/lib/utils";
import { PERMISSIONS } from "../constants/permissions";
import type { UserInvitationResult } from "../interfaces/user-invitation-result";
import { userInvitationSchema, type UserInvitationInput } from "../schemas/user-invitation-schema";
import { requireAuthorizedSession } from "../server";

const invitationRedirect = "/auth/reset-password";

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("body" in error) return getErrorCode(error.body);
  if ("cause" in error) return getErrorCode(error.cause);
  return null;
}

function isUniqueConstraintError(error: unknown) {
  return getErrorCode(error) === "23505";
}

async function findIdentityConflict(email: string, username: string) {
  const [existing] = await db
    .select({ email: user.email, username: user.username })
    .from(user)
    .where(or(eq(user.email, email), eq(user.username, username)))
    .limit(1);

  if (existing?.email === email) return "DUPLICATE_EMAIL" as const;
  if (existing?.username === username) return "DUPLICATE_USERNAME" as const;
  return null;
}

function createTrustedSignUpRequest() {
  return createTrustedInvitationRequest("http://localhost/api/auth/sign-up/email");
}

async function requestInvitation(email: string) {
  await requestInvitationPasswordReset(email, invitationRedirect);
}

export async function inviteUser(input: UserInvitationInput): Promise<UserInvitationResult> {
  try {
    await requireAuthorizedSession(PERMISSIONS.USERS_INVITE);
    const parsed = userInvitationSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, code: "VALIDATION_ERROR", details: getFieldErrors(parsed.error) };
    }

    const { name, email, username, locale } = parsed.data;
    const conflict = await findIdentityConflict(email, username);
    if (conflict) return { success: false, code: conflict };

    let createdUser: { id: string };
    try {
      const result = await auth.api.signUpEmail({
        body: {
          name,
          email,
          username,
          password: randomBytes(32).toString("base64url"),
        },
        request: createTrustedSignUpRequest(),
      });
      createdUser = result.user;
    } catch (error) {
      const code = getErrorCode(error);
      if (code === "USERNAME_IS_ALREADY_TAKEN") {
        return { success: false, code: "DUPLICATE_USERNAME" };
      }
      if (isUniqueConstraintError(error) || code === "FAILED_TO_CREATE_USER") {
        const racedConflict = await findIdentityConflict(email, username);
        if (racedConflict) return { success: false, code: racedConflict };
      }
      throw error;
    }

    const invitedAt = new Date();
    const persisted = await db
      .update(user)
      .set({ invitedAt, locale })
      .where(and(eq(user.id, createdUser.id), eq(user.email, email)))
      .returning({ id: user.id });
    if (persisted.length === 0) return { success: false, code: "DUPLICATE_EMAIL" };

    try {
      await requestInvitation(email);
    } catch {
      revalidatePath("/admin/users");
      return {
        success: false,
        code: "INVITATION_DELIVERY_FAILED",
        pendingUserId: createdUser.id,
      };
    }

    revalidatePath("/admin/users");
    return { success: true, data: { userId: createdUser.id } };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { success: false, code: "UNAUTHORIZED" };
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return { success: false, code: "FORBIDDEN" };
    }
    return { success: false, code: "INVITATION_FAILED" };
  }
}

export async function resendUserInvitation(userId: string): Promise<UserInvitationResult> {
  try {
    await requireAuthorizedSession(PERMISSIONS.USERS_INVITE);
    const [pendingUser] = await db
      .select({ id: user.id, email: user.email, invitedAt: user.invitedAt })
      .from(user)
      .where(and(eq(user.id, userId), isNotNull(user.invitedAt)))
      .limit(1);
    if (!pendingUser) return { success: false, code: "INVITATION_NOT_PENDING" };

    try {
      await requestInvitation(pendingUser.email);
    } catch {
      return {
        success: false,
        code: "INVITATION_DELIVERY_FAILED",
        pendingUserId: pendingUser.id,
      };
    }

    revalidatePath("/admin/users");
    return { success: true, data: { userId: pendingUser.id } };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return { success: false, code: "UNAUTHORIZED" };
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return { success: false, code: "FORBIDDEN" };
    }
    return { success: false, code: "INVITATION_FAILED" };
  }
}
