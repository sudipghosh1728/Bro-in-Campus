import { NextRequest } from "next/server";
import { fail, ok, pageSize } from "@/lib/api";
import { getRequestUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const viewer = await getRequestUser(request);
    const users = await prisma.user.findMany({ where: { isSuspended: false, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] } : {}) }, take: pageSize(request.nextUrl.searchParams.get("take")), select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true, college: true, campus: true } }, _count: { select: { followedBy: true, questions: true } }, followedBy: viewer ? { where: { followerId: viewer.id }, select: { followerId: true } } : { take: 0, select: { followerId: true } } } });
    return ok(users.map((user) => ({ id: user.id, name: user.name, username: user.username, avatarUrl: user.profile?.avatarUrl ?? null, college: user.profile?.college ?? null, campus: user.profile?.campus ?? null, followerCount: user._count.followedBy, questionCount: user._count.questions, following: user.followedBy.length > 0 })));
  } catch (error) { return fail(error); }
}
