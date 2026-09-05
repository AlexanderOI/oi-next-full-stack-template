import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import es from "../../../messages/es.json";
import {
  localizeSystemRoles,
  PERMISSIONS,
  type RoleSummary,
} from "@/features/authorization/contracts";

describe("authorization localization", () => {
  it("translates system roles by invariant key and leaves custom content unchanged", () => {
    const roles: RoleSummary[] = [
      {
        id: "admin-id",
        key: "admin",
        name: "Administrator",
        description: "Full application administration",
        isSystem: true,
        permissions: [PERMISSIONS.ROLES_READ],
      },
      {
        id: "custom-id",
        key: "customer.success",
        name: "Customer Success",
        description: "Texto escrito por el usuario",
        isSystem: false,
        permissions: [PERMISSIONS.PROFILE_READ_OWN],
      },
    ];
    const t = createTranslator({
      locale: "es",
      messages: es,
      namespace: "authorization.systemRoles",
    });

    const localized = localizeSystemRoles(roles, t);
    expect(localized[0]).toMatchObject({ name: "Administrador", key: "admin" });
    expect(localized[1]).toEqual(roles[1]);
  });
});
