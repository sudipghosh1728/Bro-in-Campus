import type { User } from "@prisma/client";
import { cache } from "react";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { ApiError } from "./api";
import { prisma } from "./prisma";
import { Role, type Role as RoleValue } from "./domain";

const SESSION_COOKIE = "bic_session";
const ADMIN_SESSION_COOKIE = "bic_admin_session";
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

async function signSession(payload: SessionPayload, expiresAt?: Date) {
  const token = new SignJWT({ sid: payload.sid, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt();
  if (expiresAt) token.setExpirationTime(Math.floor(expiresAt.getTime() / 1000));
  else token.setExpirationTime("30d");
  return token.sign(sessionSecret());
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
  setAuthCookie(response, SESSION_COOKIE, token, expiresAt, request);
}

export function setAdminSessionCookie(response: NextResponse, token: string, expiresAt: Date, request?: NextRequest) {
  setAuthCookie(response, ADMIN_SESSION_COOKIE, token, expiresAt, request);
}

function expireCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", { httpOnly: true, expires: new Date(0), path: "/" });
}

export function clearSessionCookie(response: NextResponse) {
  expireCookie(response, SESSION_COOKIE);
  expireCookie(response, ADMIN_SESSION_COOKIE);
}

export function clearAdminSessionCookie(response: NextResponse) {
  expireCookie(response, ADMIN_SESSION_COOKIE);
}

export async function createImpersonationSession(
  admin: Pick<CurrentUser, "id" | "email">,
  target: Pick<CurrentUser, "id" | "email" | "role">,
  request: NextRequest,
  adminExpiresAt: Date,
) {
  const expiresAt = new Date(Math.min(Date.now() + SESSION_DURATION_MS, adminExpiresAt.getTime()));
  const session = await prisma.$transaction(async (tx) => {
    const createdSession = await tx.session.create({
      data: {
        userId: target.id,
        expiresAt,
        userAgent: request.headers.get("user-agent")?.slice(0, 512),
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      },
    });
    await tx.adminImpersonation.create({
      data: {
        adminId: admin.id,
        targetId: target.id,
        sessionId: createdSession.id,
        adminEmail: admin.email,
        targetEmail: target.email,
        endedAt: null,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request.headers.get("user-agent")?.slice(0, 512),
      },
    });
    return createdSession;
  });
  return { token: await signSession({ sub: target.id, sid: session.id, role: target.role }, expiresAt), expiresAt };
}

export async function getRequestSessionCookie(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const resolved = await resolveSession(token);
  return resolved ? { token, expiresAt: resolved.session.expiresAt } : null;
}

export async function getRequestImpersonation(request: NextRequest) {
  return resolveImpersonationContext(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, request.cookies.get(SESSION_COOKIE)?.value);
}

async function resolveImpersonationContext(adminToken?: string, targetToken?: string) {
  if (!adminToken || !targetToken) return null;
  const [adminContext, targetPayload] = await Promise.all([resolveSession(adminToken), verifySession(targetToken)]);
  if (!adminContext || !targetPayload || adminContext.user.role !== Role.ADMIN || adminContext.user.isSuspended) return null;
  const audit = await prisma.adminImpersonation.findUnique({ where: { sessionId: targetPayload.sid } });
  if (!audit || audit.endedAt || audit.adminId !== adminContext.user.id || audit.targetId !== targetPayload.sub) return null;
  const targetContext = await resolveSession(targetToken);
  return {
    admin: adminContext.user,
    target: targetContext?.user ?? null,
    targetId: audit.targetId,
    targetEmail: audit.targetEmail,
    adminToken,
    adminExpiresAt: adminContext.session.expiresAt,
    targetSessionId: targetPayload.sid,
  };
}

export async function getCurrentImpersonation() {
  return (await getServerAuth()).impersonation;
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

async function resolveSession(token?: string) {
  const payload = await verifySession(token);
  if (!payload) return null;
  const session = await prisma.session.findUnique({ where: { id: payload.sid }, select: { userId: true, expiresAt: true, revokedAt: true } });
  if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: userSelect });
  return user ? { user: { ...user, role: user.role as RoleValue }, session, payload } : null;
}

async function resolveUser(token?: string): Promise<CurrentUser | null> {
  return (await resolveSession(token))?.user ?? null;
}

function setAuthCookie(response: NextResponse, name: string, token: string, expiresAt: Date, request?: NextRequest) {
  const forwardedProtocol = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = forwardedProtocol === "https" || request?.nextUrl.protocol === "https:";
  response.cookies.set(name, token, { httpOnly: true, secure, sameSite: "lax", expires: expiresAt, path: "/" });
}

const getServerAuth = cache(async () => {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (adminToken) {
    const impersonation = await resolveImpersonationContext(adminToken, cookieStore.get(SESSION_COOKIE)?.value);
    return {
      user: impersonation?.target ? { ...impersonation.target, role: Role.USER } : null,
      impersonation: impersonation ? { adminName: impersonation.admin.name, targetName: impersonation.target?.name ?? impersonation.targetEmail } : null,
    };
  }
  return { user: await resolveUser(cookieStore.get(SESSION_COOKIE)?.value), impersonation: null };
});

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getServerAuth()).user;
}

export async function getRequestUser(request: NextRequest): Promise<CurrentUser | null> {
  const adminToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (adminToken) {
    const impersonation = await resolveImpersonationContext(adminToken, request.cookies.get(SESSION_COOKIE)?.value);
    return impersonation?.target ? { ...impersonation.target, role: Role.USER } : null;
  }
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
  const now = new Date();
  const tokens = [request.cookies.get(SESSION_COOKIE)?.value, request.cookies.get(ADMIN_SESSION_COOKIE)?.value];
  for (const token of tokens) {
    const payload = await verifySession(token);
    if (!payload) continue;
    await prisma.session.updateMany({ where: { id: payload.sid, OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }] }, data: { revokedAt: now } });
    await prisma.adminImpersonation.updateMany({ where: { sessionId: payload.sid, endedAt: null }, data: { endedAt: now } });
  }
}
