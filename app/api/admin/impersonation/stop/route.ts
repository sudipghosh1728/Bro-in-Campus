import { NextRequest } from "next/server";
import { ApiError, fail, ok } from "@/lib/api";
import { clearAdminSessionCookie, getRequestImpersonation, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestImpersonation(request);
    if (!context) throw new ApiError(403, "NO_ACTIVE_IMPERSONATION", "There is no active admin impersonation to end.");
    const endedAt = new Date();
    await prisma.$transaction(async (tx) => {
      const audit = await tx.adminImpersonation.updateMany({
        where: {
          sessionId: context.targetSessionId,
          adminId: context.admin.id,
          targetId: context.targetId,
          endedAt: null,
        },
        data: { endedAt },
      });
      if (!audit.count) throw new ApiError(409, "IMPERSONATION_ENDED", "This impersonation session has already ended.");
      await tx.session.updateMany({ where: { id: context.targetSessionId }, data: { revokedAt: endedAt } });
    });
    const response = ok({ impersonating: false });
    setSessionCookie(response, context.adminToken, context.adminExpiresAt, request);
    clearAdminSessionCookie(response);
    return response;
  } catch (error) {
    return fail(error);
  }
}
