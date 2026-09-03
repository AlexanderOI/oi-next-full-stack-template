"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AuthorizationSnapshot } from "../interfaces/authorization-snapshot";
import type { PermissionKey, PermissionMatch } from "../interfaces/permission";
import { evaluatePermissions } from "../lib/authorization-policy";

const AuthorizationContext = createContext<AuthorizationSnapshot | null>(null);

interface Props {
  snapshot: AuthorizationSnapshot;
  children: ReactNode;
}

export function AuthorizationProvider({ snapshot, children }: Props) {
  return <AuthorizationContext value={snapshot}>{children}</AuthorizationContext>;
}

function useAuthorizationSnapshot() {
  return useContext(AuthorizationContext);
}

export function usePermission(permission: PermissionKey) {
  const snapshot = useAuthorizationSnapshot();
  return snapshot ? evaluatePermissions(snapshot.permissions, [permission], "all") : false;
}

export function useAnyPermission(permissions: readonly PermissionKey[]) {
  const snapshot = useAuthorizationSnapshot();
  return snapshot ? evaluatePermissions(snapshot.permissions, permissions, "any") : false;
}

export function useAllPermissions(permissions: readonly PermissionKey[]) {
  const snapshot = useAuthorizationSnapshot();
  return snapshot ? evaluatePermissions(snapshot.permissions, permissions, "all") : false;
}

export function Permission({
  permissions,
  match = "all",
  fallback = null,
  children,
}: {
  permissions: PermissionKey | readonly PermissionKey[];
  match?: PermissionMatch;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const snapshot = useAuthorizationSnapshot();
  const requested = Array.isArray(permissions) ? permissions : [permissions];
  const allowed = snapshot ? evaluatePermissions(snapshot.permissions, requested, match) : false;
  return allowed ? children : fallback;
}
