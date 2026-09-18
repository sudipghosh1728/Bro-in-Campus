import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteComment, updateComment } from "@/lib/community";
import { commentSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try { const { id } = await context.params; const { body } = commentSchema.parse(await request.json()); return ok(await updateComment(await requireUser(request), id, body)); } catch (error) { return fail(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try { const { id } = await context.params; await deleteComment(await requireUser(request), id); return ok({ deleted: true }); } catch (error) { return fail(error); }
}
