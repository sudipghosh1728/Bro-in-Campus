import { NextRequest } from "next/server";
import { Role } from "@/lib/domain";
import { fail, ok } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { topicSchema } from "@/lib/validation";

export async function GET() {
  try {
    const topics = await prisma.topic.findMany({ orderBy: { followers: { _count: "desc" } }, include: { _count: { select: { followers: true, questions: true } } } });
    return ok(topics.map((topic) => ({ id: topic.id, name: topic.name, slug: topic.slug, description: topic.description, followerCount: topic._count.followers, questionCount: topic._count.questions })));
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    requireRole(user, [Role.ADMIN]);
    const input = topicSchema.parse(await request.json());
    const topic = await prisma.topic.create({ data: { ...input, slug: slugify(input.name) } });
    return ok(topic, 201);
  } catch (error) { return fail(error); }
}
