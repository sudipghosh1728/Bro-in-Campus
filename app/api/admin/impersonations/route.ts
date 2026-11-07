import { NextRequest } from "next/server";
import { Role } from "@/lib/domain";
import { fail, ok, pageSize } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireUser(request);
    requireRole(admin, [Role.ADMIN]);
    const records = await prisma.adminImpersonation.findMany({
      orderBy: { startedAt: "desc" },
      take: pageSize(request.nextUrl.searchParams.get("take"), 30, 100),
      select: { id: true, adminEmail: true, targetEmail: true, ipAddress: true, startedAt: true, endedAt: true },
    });
    return ok(records);
  } catch (error) {
    return fail(error);
  }
}
