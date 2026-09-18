import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { getRequestUser, requireUser } from "@/lib/auth";
import { createCommunityIssue, getResidenceLivingData } from "@/lib/living";
import { communityIssueSchema, mongoId } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { id } = await params;
    return ok(await getResidenceLivingData(mongoId.parse(id), await getRequestUser(request)));
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    return ok(await createCommunityIssue(user, mongoId.parse(id), communityIssueSchema.parse(await request.json())), 201);
  } catch (error) { return fail(error); }
}
