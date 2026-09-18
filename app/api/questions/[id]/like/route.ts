import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { toggleQuestionVote } from "@/lib/community";
import { mongoId } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    return ok(await toggleQuestionVote(user, mongoId.parse(id), true));
  } catch (error) { return fail(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    return ok(await toggleQuestionVote(user, mongoId.parse(id), false));
  } catch (error) { return fail(error); }
}
