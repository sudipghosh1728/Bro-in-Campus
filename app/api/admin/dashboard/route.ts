import { NextRequest } from "next/server";
import { Role } from "@/lib/domain";
import { fail, ok, pageSize } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { adminAnalytics } from "@/lib/community";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    requireRole(user, [Role.ADMIN, Role.MODERATOR]);
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const take = pageSize(request.nextUrl.searchParams.get("take"), 30, 50);

    const [analytics, users, impersonations, colleges] = await Promise.all([
      adminAnalytics(),
      prisma.user.findMany({
        where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] } : {},
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, name: true, email: true, username: true, role: true, isSuspended: true, createdAt: true, _count: { select: { questions: true, answers: true } } },
      }),
      user.role === Role.ADMIN
        ? prisma.adminImpersonation.findMany({
          orderBy: { startedAt: "desc" },
          take: 30,
          select: { id: true, adminEmail: true, targetEmail: true, ipAddress: true, startedAt: true, endedAt: true },
        })
        : Promise.resolve([]),
      user.role === Role.ADMIN
        ? prisma.college.findMany({
          orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
          take: 100,
          select: { id: true, name: true, slug: true, city: true, state: true, country: true, type: true, website: true, description: true, aisheCode: true, address: true, buildingCount: true, residentLabel: true, latitude: true, longitude: true, coverColor: true, verified: true, _count: { select: { members: true } } },
        })
        : Promise.resolve([]),
    ]);

    return ok({
      analytics,
      reports: analytics.recentReports,
      users: users.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      impersonations,
      colleges,
    });
  } catch (error) {
    return fail(error);
  }
}
