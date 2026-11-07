import { NextRequest } from "next/server";
import { Role } from "@/lib/domain";
import { fail, ok, pageSize } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { createCollege } from "@/lib/colleges";
import { prisma } from "@/lib/prisma";
import { adminCollegeCreateSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireUser(request);
    requireRole(admin, [Role.ADMIN]);
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const colleges = await prisma.college.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] } : {},
      orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
      take: pageSize(request.nextUrl.searchParams.get("take"), 50, 100),
      select: { id: true, name: true, slug: true, city: true, state: true, country: true, type: true, website: true, description: true, aisheCode: true, address: true, buildingCount: true, residentLabel: true, latitude: true, longitude: true, coverColor: true, verified: true, _count: { select: { members: true } } },
    });
    return ok(colleges);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireUser(request);
    requireRole(admin, [Role.ADMIN]);
    const input = adminCollegeCreateSchema.parse(await request.json());
    return ok(await createCollege(admin, input), 201);
  } catch (error) {
    return fail(error);
  }
}
