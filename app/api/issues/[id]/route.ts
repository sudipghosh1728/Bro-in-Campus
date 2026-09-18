import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { resolveCommunityIssue } from "@/lib/living";
import { mongoId } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    return ok(await resolveCommunityIssue(user, mongoId.parse(id)));
  } catch (error) { return fail(error); }
}
