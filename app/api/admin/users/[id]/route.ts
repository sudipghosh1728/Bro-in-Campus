import { NextRequest } from "next/server";
import { Role } from "@/lib/domain";
import { z } from "zod";
import { ApiError, fail, ok } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ isSuspended: z.boolean() });

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requireUser(request);
    requireRole(actor, [Role.ADMIN, Role.MODERATOR]);
    const { id } = await context.params;
    if (id === actor.id) throw new ApiError(422, "SELF_UPDATE", "You cannot suspend your own account.");
    const { isSuspended } = schema.parse(await request.json());
    const user = await prisma.user.update({ where: { id }, data: { isSuspended }, select: { id: true, isSuspended: true } });
    return ok(user);
  } catch (error) { return fail(error); }
}
