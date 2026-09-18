import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = profileSchema.parse(await request.json());
    const updated = await prisma.user.update({ where: { id: user.id }, data: { ...(input.name ? { name: input.name } : {}), profile: { upsert: { create: { bio: input.bio ?? undefined, college: input.college ?? undefined, campus: input.campus ?? undefined, course: input.course ?? undefined, profession: input.profession ?? undefined, interests: input.interests ?? [] }, update: { ...(input.bio !== undefined ? { bio: input.bio } : {}), ...(input.college !== undefined ? { college: input.college } : {}), ...(input.campus !== undefined ? { campus: input.campus } : {}), ...(input.course !== undefined ? { course: input.course } : {}), ...(input.profession !== undefined ? { profession: input.profession } : {}), ...(input.interests ? { interests: input.interests } : {}) } } } }, include: { profile: true } });
    return ok({ id: updated.id, name: updated.name, username: updated.username, profile: updated.profile });
  } catch (error) { return fail(error); }
}
