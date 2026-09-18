import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createComment } from "@/lib/community";
import { commentSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try { const { id } = await context.params; const input = commentSchema.parse(await request.json()); return ok(await createComment(await requireUser(request), { questionId: id }, input.body, input.parentId), 201); } catch (error) { return fail(error); }
}
