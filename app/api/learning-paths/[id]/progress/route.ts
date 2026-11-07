import { NextRequest, NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getLearningProgress, saveLearningProgress } from "@/lib/learning-progress";
import { learningProgressSchema, mongoId } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 60;
const privateResponse = (response: NextResponse) => {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const id = mongoId.parse((await params).id);
    return privateResponse(ok(await getLearningProgress(user.id, id)));
  } catch (error) { return privateResponse(fail(error)); }
}

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const id = mongoId.parse((await params).id);
    const input = learningProgressSchema.parse(await request.json());
    return privateResponse(ok(await saveLearningProgress(user.id, id, input.completedMilestones)));
  } catch (error) { return privateResponse(fail(error)); }
}
