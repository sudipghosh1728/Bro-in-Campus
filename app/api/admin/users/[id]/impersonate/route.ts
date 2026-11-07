import { NextRequest } from "next/server";
import { ApiError, fail, ok } from "@/lib/api";
import { createImpersonationSession, getRequestSessionCookie, requireRole, requireUser, setAdminSessionCookie, setSessionCookie } from "@/lib/auth";
import { Role } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { mongoId } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const admin = await requireUser(request);
    requireRole(admin, [Role.ADMIN]);
    const session = await getRequestSessionCookie(request);
    if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in again before impersonating a user.");

    const id = mongoId.parse((await params).id);
    if (id === admin.id) throw new ApiError(422, "SELF_IMPERSONATION", "You cannot impersonate your own account.");
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, isSuspended: true } });
    if (!target) throw new ApiError(404, "NOT_FOUND", "Account not found.");
    if (target.role !== "USER") throw new ApiError(422, "PRIVILEGED_ACCOUNT", "Only standard user accounts can be impersonated.");
    if (target.isSuspended) throw new ApiError(422, "ACCOUNT_SUSPENDED", "Suspended accounts cannot be impersonated.");

    const impersonated = await createImpersonationSession(admin, { id: target.id, email: target.email, role: Role.USER }, request, session.expiresAt);
    const response = ok({ impersonating: true });
    setAdminSessionCookie(response, session.token, session.expiresAt, request);
    setSessionCookie(response, impersonated.token, impersonated.expiresAt, request);
    return response;
  } catch (error) {
    return fail(error);
  }
}
