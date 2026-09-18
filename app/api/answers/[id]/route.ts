import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteAnswer, updateAnswer } from "@/lib/community";
import { answerSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try { const { id } = await context.params; const { body } = answerSchema.parse(await request.json()); return ok(await updateAnswer(await requireUser(request), id, body)); } catch (error) { return fail(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try { const { id } = await context.params; await deleteAnswer(await requireUser(request), id); return ok({ deleted: true }); } catch (error) { return fail(error); }
}
