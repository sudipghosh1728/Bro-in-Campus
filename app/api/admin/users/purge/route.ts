import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { Role } from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { purgeNonAdminUsers } from "@/lib/admin-user-cleanup";

const schema = z.object({ confirmation: z.literal("DELETE NON-ADMIN USERS") });

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser(request);
    requireRole(actor, [Role.ADMIN]);
    schema.parse(await request.json());

    const deletedUsers = await prisma.$transaction((tx) => purgeNonAdminUsers(tx));
    return ok({ deletedUsers, preservedAdminAccounts: true });
  } catch (error) {
    return fail(error);
  }
}
