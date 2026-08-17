import { createTranslator } from "next-intl";

import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";

type VerificationEmailInput = {
  name: string;
  url: string;
  locale: Locale;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character
  );
}

function verificationEmail({
  name,
  url,
  locale,
  subject,
  heading,
  message,
  buttonLabel,
  greeting,
  ignoreMessage,
}: VerificationEmailInput & {
  subject: string;
  heading: string;
  message: string;
  buttonLabel: string;
  greeting: string;
  ignoreMessage: string;
}) {
  const safeUrl = escapeHtml(url);

  const html = `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:560px;margin:40px auto;padding:32px;background:#ffffff;border-radius:12px">
      <h1 style="margin:0 0 16px;font-size:24px">${heading}</h1>
      <p style="margin:0 0 12px;line-height:1.6">${greeting}</p>
      <p style="margin:0 0 24px;line-height:1.6">${message}</p>
      <a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px">${buttonLabel}</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#71717a">${ignoreMessage}</p>
    </div>
  </body>
</html>`;

  return { subject, html };
}

function getEmailTranslator(locale: Locale) {
  return createTranslator({ locale, messages: getMessages(locale), namespace: "emails" });
}

export function accountVerificationEmail(input: VerificationEmailInput) {
  const t = getEmailTranslator(input.locale);
  return verificationEmail({
    ...input,
    subject: t("account.subject"),
    heading: t("account.heading"),
    message: t("account.message"),
    buttonLabel: t("account.button"),
    greeting: t("greeting", { name: escapeHtml(input.name) }),
    ignoreMessage: t("ignore"),
  });
}

export function emailChangeVerificationEmail(input: VerificationEmailInput) {
  const t = getEmailTranslator(input.locale);
  return verificationEmail({
    ...input,
    subject: t("emailChange.subject"),
    heading: t("emailChange.heading"),
    message: t("emailChange.message"),
    buttonLabel: t("emailChange.button"),
    greeting: t("greeting", { name: escapeHtml(input.name) }),
    ignoreMessage: t("ignore"),
  });
}
