import { NextRequest, NextResponse } from "next/server";
import { ApiError, fail, ok } from "@/lib/api";
import { getRequestImpersonation, getRequestUser, requireUser } from "@/lib/auth";
import { getCampusConsensus, proposeCampusDecision, voteCampusDecision } from "@/lib/campus-consensus";
import { campusProposalSchema, campusVoteSchema } from "@/lib/consensus-validation";
import { mongoId } from "@/lib/validation";
import { allowRequest } from "@/lib/rate-limit";

type Context = { params: Promise<{ id: string }> };
export const maxDuration = 60;
const privateResponse = (response: NextResponse) => { response.headers.set("Cache-Control", "private, no-store"); return response; };

export async function GET(request: NextRequest, { params }: Context) {
  try { return privateResponse(ok(await getCampusConsensus(mongoId.parse((await params).id), await getRequestUser(request)))); }
  catch (error) { return privateResponse(fail(error)); }
}

async function votingUser(request: NextRequest) {
  const user = await requireUser(request);
  if (await getRequestImpersonation(request)) throw new ApiError(403, "IMPERSONATION_BLOCKED", "Stop impersonating before voting. Reviews must represent the actual account holder.");
  if (!allowRequest(`campus-review:${user.id}`, 30)) throw new ApiError(429, "RATE_LIMIT", "Please wait a minute before submitting more reviews.");
  return user;
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const user = await votingUser(request);
    return privateResponse(ok(await proposeCampusDecision(user, mongoId.parse((await params).id), campusProposalSchema.parse(await request.json())), 201));
  } catch (error) { return privateResponse(fail(error)); }
}

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const user = await votingUser(request);
    const input = campusVoteSchema.parse(await request.json());
    return privateResponse(ok(await voteCampusDecision(user, mongoId.parse((await params).id), input.decisionId, input.proposalId)));
  } catch (error) { return privateResponse(fail(error)); }
}
