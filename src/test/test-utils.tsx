import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import type { Locale } from "@/i18n/config";

function AllProviders({ children, locale = "en" }: { children: ReactNode; locale?: Locale }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : es}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

function renderWithLocale(
  ui: ReactElement,
  locale: Locale,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, {
    wrapper: ({ children }) => <AllProviders locale={locale}>{children}</AllProviders>,
    ...options,
  });
}

function renderInEnglish(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return renderWithLocale(ui, "en", options);
}

function customRender(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from "@testing-library/react";
export { customRender as render, renderInEnglish, renderWithLocale };
