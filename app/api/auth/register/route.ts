import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { ApiError, fail, ok } from "@/lib/api";
import { createSession, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    if (!allowRequest(`register:${ip}`, 8, 60 * 60 * 1000)) throw new ApiError(429, "RATE_LIMITED", "Too many registration attempts. Please try again later.");
    const input = registerSchema.parse(await request.json());
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({ data: { name: input.name, username: input.username.toLowerCase(), email: input.email, passwordHash, profile: { create: { profession: input.profession } } }, select: { id: true, name: true, username: true, role: true } });
    const { token, expiresAt } = await createSession(user, request);
    const response = ok({ user: { id: user.id, name: user.name, username: user.username, role: user.role } }, 201);
    setSessionCookie(response, token, expiresAt, request);
    return response;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return fail(new ApiError(409, "ALREADY_EXISTS", "That email address or username is already in use."));
    return fail(error);
  }
}
