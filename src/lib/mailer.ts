import nodemailer from "nodemailer";

import { env } from "@/config/env";

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailInput) {
  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}
