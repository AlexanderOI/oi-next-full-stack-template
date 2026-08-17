import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

function keys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("message catalogs", () => {
  it("keeps exact key parity with English as the source catalog", () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });

  it.each([
    ["en" as const, en, "2 of 3 roles"],
    ["es" as const, es, "2 de 3 roles"],
  ])("supports ICU plural and interpolation in %s", (locale, messages, expected) => {
    const t = createTranslator({ locale, messages, namespace: "authorization.roles" });
    expect(t("count", { visible: 2, total: 3 })).toBe(expected);
  });
});
