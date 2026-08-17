import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";

import { createProfileSchema } from "@/features/profile/contracts";
import es from "../../../messages/es.json";

const profileSchema = createProfileSchema((key) => key);

describe("profileSchema", () => {
  it("normalizes whitespace and email casing", () => {
    expect(
      profileSchema.parse({
        name: "  Alex Doe  ",
        username: "  alex.doe  ",
        email: "  ALEX@EXAMPLE.COM  ",
      })
    ).toEqual({
      name: "Alex Doe",
      username: "alex.doe",
      email: "alex@example.com",
    });
  });

  it("rejects usernames outside the Better Auth username convention", () => {
    const result = profileSchema.safeParse({
      name: "Alex Doe",
      username: "Alex_Doe",
      email: "alex@example.com",
    });

    expect(result.success).toBe(false);
  });

  it("returns localized user-facing validation messages", () => {
    const t = createTranslator({ locale: "es", messages: es, namespace: "profile.validation" });
    const result = createProfileSchema(t).safeParse({
      name: "A",
      username: "INVALID_NAME",
      email: "invalid",
    });

    expect(result.error?.issues.map(({ message }) => message)).toEqual(
      expect.arrayContaining([
        "El nombre debe tener al menos 2 caracteres",
        "El nombre de usuario solo puede contener letras minúsculas, números y puntos",
        "La dirección de correo electrónico no es válida",
      ])
    );
  });
});
