type VerificationEmailInput = {
  name: string;
  url: string;
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
  heading,
  message,
  buttonLabel,
}: VerificationEmailInput & {
  heading: string;
  message: string;
  buttonLabel: string;
}) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(url);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <div style="max-width:560px;margin:40px auto;padding:32px;background:#ffffff;border-radius:12px">
      <h1 style="margin:0 0 16px;font-size:24px">${heading}</h1>
      <p style="margin:0 0 12px;line-height:1.6">Hello ${safeName},</p>
      <p style="margin:0 0 24px;line-height:1.6">${message}</p>
      <a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px">${buttonLabel}</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#71717a">If you did not request this, you can ignore this email.</p>
    </div>
  </body>
</html>`;
}

export function accountVerificationEmail(input: VerificationEmailInput) {
  return verificationEmail({
    ...input,
    heading: "Verify your account",
    message: "Please verify your email address to finish setting up your account.",
    buttonLabel: "Verify email",
  });
}

export function emailChangeVerificationEmail(input: VerificationEmailInput) {
  return verificationEmail({
    ...input,
    heading: "Confirm your new email",
    message: "Please verify this email address to apply it to your account.",
    buttonLabel: "Confirm new email",
  });
}
