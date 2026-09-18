import { NextRequest } from "next/server";
import { Role } from "@/lib/domain";
import { fail, ok, pageSize } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    requireRole(user, [Role.ADMIN, Role.MODERATOR]);
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const users = await prisma.user.findMany({ where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] } : {}, orderBy: { createdAt: "desc" }, take: pageSize(request.nextUrl.searchParams.get("take")), select: { id: true, name: true, email: true, username: true, role: true, isSuspended: true, createdAt: true, _count: { select: { questions: true, answers: true } } } });
    return ok(users.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })));
  } catch (error) { return fail(error); }
}
