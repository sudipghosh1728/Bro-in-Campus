import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { ApiError } from "./api";
import { isGmailOtpConfigured, sendPasswordResetOtp } from "./email";
import { prisma } from "./prisma";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function createOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function requestPasswordReset(email: string) {
  if (!isGmailOtpConfigured()) {
    throw new ApiError(503, "EMAIL_NOT_CONFIGURED", "Password reset email is not configured. Add the Gmail SMTP values to .env first.");
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isSuspended: true } });
  // Keep the response identical for an unknown or suspended account so this
  // endpoint cannot be used to discover which email addresses are registered.
  if (!user || user.isSuspended) return { sent: true };

  const code = createOtp();
  const codeHash = await bcrypt.hash(code, 12);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const reset = await prisma.$transaction(async (tx) => {
    await tx.passwordResetOtp.updateMany({ where: { userId: user.id, OR: [{ usedAt: null }, { usedAt: { isSet: false } }] }, data: { usedAt: new Date() } });
    return tx.passwordResetOtp.create({ data: { userId: user.id, codeHash, expiresAt, usedAt: null } });
  });

  try {
    await sendPasswordResetOtp(user.email, code);
  } catch (error) {
    // Do not leave a valid code behind if Gmail rejects delivery.
    await prisma.passwordResetOtp.updateMany({ where: { id: reset.id, OR: [{ usedAt: null }, { usedAt: { isSet: false } }] }, data: { usedAt: new Date() } });
    if (error instanceof ApiError) throw error;
    console.error("Password reset email delivery failed", error);
    throw new ApiError(503, "EMAIL_DELIVERY_FAILED", "We could not send your reset code. Please try again shortly.");
  }

  return { sent: true };
}

export async function resetPasswordWithOtp(input: { email: string; code: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true, isSuspended: true } });
  if (!user || user.isSuspended) throw new ApiError(400, "INVALID_RESET_CODE", "That code is invalid or has expired. Request a new code and try again.");

  const reset = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, expiresAt: { gt: new Date() }, OR: [{ usedAt: null }, { usedAt: { isSet: false } }] },
    orderBy: { createdAt: "desc" },
  });
  if (!reset || reset.attempts >= MAX_OTP_ATTEMPTS) throw new ApiError(400, "INVALID_RESET_CODE", "That code is invalid or has expired. Request a new code and try again.");

  if (!(await bcrypt.compare(input.code, reset.codeHash))) {
    const attempts = reset.attempts + 1;
    await prisma.passwordResetOtp.updateMany({ where: { id: reset.id, OR: [{ usedAt: null }, { usedAt: { isSet: false } }] }, data: { attempts, ...(attempts >= MAX_OTP_ATTEMPTS ? { usedAt: new Date() } : {}) } });
    throw new ApiError(400, "INVALID_RESET_CODE", "That code is invalid or has expired. Request a new code and try again.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const completed = await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetOtp.updateMany({ where: { id: reset.id, OR: [{ usedAt: null }, { usedAt: { isSet: false } }] }, data: { usedAt: new Date() } });
    if (!consumed.count) throw new ApiError(400, "INVALID_RESET_CODE", "That code has already been used. Request a new one.");
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.session.updateMany({ where: { userId: user.id, OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }] }, data: { revokedAt: new Date() } });
    return true;
  });

  return { reset: completed };
}
