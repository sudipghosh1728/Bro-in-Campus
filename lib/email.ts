import nodemailer from "nodemailer";
import { ApiError } from "./api";

const gmailUser = process.env.GMAIL_USER?.trim();
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

export function isGmailOtpConfigured() {
  return Boolean(gmailUser && gmailAppPassword);
}

export async function sendPasswordResetOtp(to: string, code: string) {
  if (!gmailUser || !gmailAppPassword) {
    throw new ApiError(503, "EMAIL_NOT_CONFIGURED", "Password reset email is not configured. Add the Gmail SMTP values to .env first.");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailAppPassword },
  });

  await transporter.sendMail({
    from: process.env.GMAIL_FROM?.trim() || `Bro in Campus <${gmailUser}>`,
    to,
    subject: "Your Bro in Campus password reset code",
    text: `Your Bro in Campus password reset code is ${code}.\n\nIt expires in 10 minutes and can be used once. If you did not request this, you can safely ignore this email.`,
  });
}
