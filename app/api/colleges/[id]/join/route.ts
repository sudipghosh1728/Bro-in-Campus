import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { joinCollege, leaveCollege } from "@/lib/colleges";
import { collegeMembershipSchema, mongoId } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const collegeId = mongoId.parse(id);
    const input = collegeMembershipSchema.parse(await request.json().catch(() => ({})));
    return ok(await joinCollege(user, collegeId, input));
  } catch (error) { return fail(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    return ok(await leaveCollege(user, mongoId.parse(id)));
  } catch (error) { return fail(error); }
}
