import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { ApiError, fail, ok } from "@/lib/api";
import { createSession, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    if (!allowRequest(`login:${ip}`, 12, 15 * 60 * 1000)) throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait a few minutes.");
    const input = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true, name: true, username: true, role: true, passwordHash: true, isSuspended: true } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    if (user.isSuspended) throw new ApiError(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
    const { token, expiresAt } = await createSession(user, request);
    const response = ok({ user: { id: user.id, name: user.name, username: user.username, role: user.role } });
    setSessionCookie(response, token, expiresAt, request);
    return response;
  } catch (error) {
    return fail(error);
  }
}
