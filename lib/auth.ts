import type { User } from "@prisma/client";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { ApiError } from "./api";
import { prisma } from "./prisma";
import { Role, type Role as RoleValue } from "./domain";

const SESSION_COOKIE = "bic_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
function sessionSecret() {
  const value = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!value || value.length < 32 || value.startsWith("replace-with"))) {
    throw new Error("AUTH_SECRET must contain at least 32 private random characters in production.");
  }
  return new TextEncoder().encode(value || "development-only-secret-change-before-deployment");
}

type SessionPayload = { sub: string; sid: string; role: RoleValue };

export type CurrentUser = Omit<Pick<User, "id" | "email" | "name" | "username" | "isSuspended">, never> & {
  role: RoleValue;
  profile: { avatarUrl: string | null; college: string | null; campus: string | null; bio: string | null; course: string | null; profession: string | null; interests: string[] } | null;
};

async function signSession(payload: SessionPayload) {
  return new SignJWT({ sid: payload.sid, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(sessionSecret());
}

async function verifySession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    if (payload.role !== "USER" && payload.role !== "MODERATOR" && payload.role !== "ADMIN") return null;
    return { sub: payload.sub, sid: payload.sid, role: payload.role };
  } catch {
    return null;
  }
}

export async function createSession(user: Pick<User, "id" | "role">, request?: NextRequest) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt,
      userAgent: request?.headers.get("user-agent")?.slice(0, 512),
      ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    },
  });
  return { token: await signSession({ sub: user.id, sid: session.id, role: user.role as RoleValue }), expiresAt };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date, request?: NextRequest) {
  // `next start` is often used over HTTP on localhost. Setting Secure solely
  // from NODE_ENV prevents the browser from returning the cookie there. On a
  // deployed HTTPS request (including one behind a proxy) it remains secure.
  const forwardedProtocol = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = forwardedProtocol === "https" || request?.nextUrl.protocol === "https:";
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  username: true,
  role: true,
  isSuspended: true,
  profile: { select: { avatarUrl: true, college: true, campus: true, bio: true, course: true, profession: true, interests: true } },
} as const;

async function resolveUser(token?: string): Promise<CurrentUser | null> {
  const payload = await verifySession(token);
  if (!payload) return null;
  const session = await prisma.session.findUnique({ where: { id: payload.sid }, select: { userId: true, expiresAt: true, revokedAt: true } });
  if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: userSelect });
  return user ? { ...user, role: user.role as RoleValue } : null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  return resolveUser(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function getRequestUser(request: NextRequest): Promise<CurrentUser | null> {
  return resolveUser(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function requireUser(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  if (user.isSuspended) throw new ApiError(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
  return user;
}

export function requireRole(user: CurrentUser, roles: RoleValue[]) {
  if (!roles.includes(user.role)) throw new ApiError(403, "FORBIDDEN", "You do not have permission to do that.");
}

export async function revokeRequestSession(request: NextRequest) {
  const payload = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (payload) await prisma.session.updateMany({ where: { id: payload.sid, OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }] }, data: { revokedAt: new Date() } });
}
