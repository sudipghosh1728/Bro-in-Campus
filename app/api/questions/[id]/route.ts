import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { getRequestUser, requireUser } from "@/lib/auth";
import { deleteQuestion, getQuestionBySlug, updateQuestion } from "@/lib/community";
import { prisma } from "@/lib/prisma";
import { questionUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const question = await prisma.question.findUnique({ where: { id }, select: { slug: true } });
    if (!question) return ok(null, 404);
    return ok(await getQuestionBySlug(question.slug, await getRequestUser(request)));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    return ok(await updateQuestion(await requireUser(request), id, questionUpdateSchema.parse(await request.json())));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    await deleteQuestion(await requireUser(request), id);
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
