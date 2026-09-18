import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createAnswer } from "@/lib/community";
import { answerSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const { body } = answerSchema.parse(await request.json());
    return ok(await createAnswer(await requireUser(request), id, body), 201);
  } catch (error) {
    return fail(error);
  }
}
