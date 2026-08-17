import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-sans" }),
  Geist_Mono: () => ({ variable: "font-mono" }),
}));
vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "es"),
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("sets the document language from the request locale", async () => {
    const layout = await RootLayout({ children: <main>Contenido</main> });
    expect(layout.props.lang).toBe("es");
  });
});
