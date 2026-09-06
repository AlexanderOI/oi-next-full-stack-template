import { createTranslator } from "next-intl";

import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/messages";

interface PasswordResetEmailInput {
  name: string;
  url: string;
  locale: Locale;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ??
      character
  );
}

export function passwordResetEmail({ name, url, locale }: PasswordResetEmailInput) {
  const t = createTranslator({ locale, messages: getMessages(locale), namespace: "emails" });
  const safeUrl = escapeHtml(url);

  const html = `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:560px;margin:40px auto;padding:32px;background:#ffffff;border-radius:12px">
      <h1 style="margin:0 0 16px;font-size:24px">${t("passwordReset.heading")}</h1>
      <p style="margin:0 0 12px;line-height:1.6">${t("greeting", { name: escapeHtml(name) })}</p>
      <p style="margin:0 0 24px;line-height:1.6">${t("passwordReset.message")}</p>
      <a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px">${t("passwordReset.button")}</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#71717a">${t("passwordReset.ignore")}</p>
    </div>
  </body>
</html>`;

  return { subject: t("passwordReset.subject"), html };
}
