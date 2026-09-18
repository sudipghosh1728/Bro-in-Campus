import { NextRequest } from "next/server";
import { Role } from "@/lib/domain";
import { fail, ok } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { adminAnalytics } from "@/lib/community";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    requireRole(user, [Role.ADMIN, Role.MODERATOR]);
    return ok(await adminAnalytics());
  } catch (error) { return fail(error); }
}
