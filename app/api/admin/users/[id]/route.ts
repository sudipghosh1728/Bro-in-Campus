import { NextRequest } from "next/server";
import { Role } from "@/lib/domain";
import { z } from "zod";
import { ApiError, fail, ok } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mongoId } from "@/lib/validation";
import { purgeNonAdminUsers } from "@/lib/admin-user-cleanup";
import { refreshCampusDecisions } from "@/lib/campus-consensus";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  isSuspended: z.boolean().optional(),
  role: z.enum([Role.USER, Role.MODERATOR, Role.ADMIN]).optional(),
}).refine((input) => input.isSuspended !== undefined || input.role !== undefined, "No account changes submitted.");

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const actor = await requireUser(request);
    requireRole(actor, [Role.ADMIN, Role.MODERATOR]);
    const id = mongoId.parse((await context.params).id);
    if (id === actor.id) throw new ApiError(422, "SELF_UPDATE", "You cannot change your own account from the admin panel.");
    const input = schema.parse(await request.json());
    if (input.role !== undefined) requireRole(actor, [Role.ADMIN]);
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isSuspended: true } });
    if (!target) throw new ApiError(404, "NOT_FOUND", "Account not found.");
    if (actor.role !== Role.ADMIN && target.role === Role.ADMIN) throw new ApiError(403, "FORBIDDEN", "Only an admin can manage another admin account.");
    if (target.role === Role.ADMIN && input.role !== undefined && input.role !== Role.ADMIN) {
      throw new ApiError(422, "PROTECTED_ADMIN", "Admin accounts cannot be demoted from the admin panel.");
    }
    if (target.role === Role.ADMIN && input.isSuspended === true) {
      throw new ApiError(422, "PROTECTED_ADMIN", "Admin accounts cannot be suspended from the admin panel.");
    }
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
      where: { id },
      data: { ...(input.isSuspended !== undefined ? { isSuspended: input.isSuspended } : {}), ...(input.role ? { role: input.role } : {}) },
      select: { id: true, role: true, isSuspended: true },
      });
      if (input.isSuspended !== undefined) {
        const votes = await tx.campusDecisionVote.findMany({ where: { userId: id }, select: { decisionId: true } });
        await refreshCampusDecisions(tx, votes.map((vote) => vote.decisionId));
      }
      return updated;
    }, { timeout: 15000 });
    return ok(user);
  } catch (error) { return fail(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const admin = await requireUser(request);
    requireRole(admin, [Role.ADMIN]);
    const id = mongoId.parse((await context.params).id);
    if (id === admin.id) throw new ApiError(422, "SELF_DELETE", "You cannot delete your own account.");
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) throw new ApiError(404, "NOT_FOUND", "Account not found.");
    if (target.role === Role.ADMIN) throw new ApiError(422, "PROTECTED_ADMIN", "Admin accounts are protected from deletion.");
    const deletedUsers = await prisma.$transaction((tx) => purgeNonAdminUsers(tx, id));
    if (!deletedUsers) throw new ApiError(409, "ACCOUNT_CHANGED", "This account changed while the deletion was being processed. Refresh and try again.");
    return ok({ deleted: true });
  } catch (error) { return fail(error); }
}
