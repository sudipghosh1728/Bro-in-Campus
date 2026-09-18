import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { toggleAnswerVote } from "@/lib/community";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try { const { id } = await context.params; return ok(await toggleAnswerVote(await requireUser(request), id, true)); } catch (error) { return fail(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try { const { id } = await context.params; return ok(await toggleAnswerVote(await requireUser(request), id, false)); } catch (error) { return fail(error); }
}
