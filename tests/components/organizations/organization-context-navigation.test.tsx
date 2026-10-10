import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

const switchOrganization = vi.hoisted(() => vi.fn());
vi.mock("@/features/organizations/actions/switch-organization", () => ({ switchOrganization }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { OrganizationChooser } from "@/features/organizations/components/organization-chooser";
import { OrganizationContextChoice } from "@/features/organizations/components/organization-context-choice";

const target = { organizationId: "org-b", organizationSlug: "bravo", organizationName: "Bravo" };
const active = { organizationId: "org-a", organizationSlug: "alpha", organizationName: "Alpha" };

function renderInLocale(locale: "en" | "es", component: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : es}>
      {component}
    </NextIntlClientProvider>
  );
}

describe("authenticated organization recovery", () => {
  it.each([
    ["en", "Your organizations", /selector in the header/i],
    ["es", "Tus organizaciones", /selector del encabezado/i],
  ] as const)(
    "lists memberships without another switch control in %s",
    (locale, heading, instruction) => {
      renderInLocale(
        locale,
        <OrganizationChooser organizations={[{ id: "org-a", slug: "alpha", name: "Alpha" }]} />
      );
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.getByText(instruction)).toBeInTheDocument();
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(switchOrganization).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["en", "No organization access", /active organization membership/i],
    ["es", "Sin acceso a organizaciones", /membresía activa/i],
  ] as const)("explains empty membership in %s", (locale, heading, explanation) => {
    renderInLocale(locale, <OrganizationChooser organizations={[]} />);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.getByText(explanation)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    ["en", "Go to Alpha", /selector in the header/i],
    ["es", "Ir a Alpha", /selector del encabezado/i],
  ] as const)(
    "links only the active organization on mismatch in %s",
    (locale, link, instruction) => {
      renderInLocale(locale, <OrganizationContextChoice target={target} active={active} />);
      expect(screen.getByRole("link", { name: link })).toHaveAttribute("href", "/org/alpha");
      expect(screen.getByText(instruction)).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(switchOrganization).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["en", "Select an organization", /selector in the header/i],
    ["es", "Selecciona una organización", /selector del encabezado/i],
  ] as const)(
    "instructs header selection without active context in %s",
    (locale, heading, instruction) => {
      renderInLocale(locale, <OrganizationContextChoice target={target} />);
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.getByText(instruction)).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    }
  );
});
