import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "./api";
import type { CurrentUser } from "./auth";
import { requireSafePublicContent } from "./content-safety";
import { evaluateConsensus } from "./consensus-policy";
import { campusProposalSchema } from "./consensus-validation";
import type { CampusProposalInput, ConsensusBoard } from "./consensus-types";
import { prisma } from "./prisma";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
type Tx = Prisma.TransactionClient;

async function transaction<T>(operation: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await prisma.$transaction(operation, { maxWait: 5000, timeout: 15000 }); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(error.code)) throw error;
      if (attempt === 2) throw new ApiError(409, "VOTE_CONFLICT", "Another review was saved at the same time. Please try again.");
    }
  }
  throw new ApiError(409, "VOTE_CONFLICT", "Please try again.");
}

async function requireMember(tx: Tx, user: CurrentUser, collegeId: string) {
  if (user.isSuspended) throw new ApiError(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
  const member = await tx.collegeMembership.findUnique({ where: { userId_collegeId: { userId: user.id, collegeId } } });
  if (!member) throw new ApiError(403, "MEMBERSHIP_REQUIRED", "Join this campus before submitting a proposal or vote.");
}

async function reconcile(tx: Tx, decisionId: string) {
  const decision = await tx.campusDecision.findUniqueOrThrow({
    where: { id: decisionId },
    include: { proposals: { include: { _count: { select: { votes: { where: { user: { is: { isSuspended: false } } } } } } } } },
  });
  const result = evaluateConsensus(decision.proposals.map((proposal) => ({ id: proposal.id, votes: proposal._count.votes })));
  if (!result.winnerId) return; // Keep the last agreed result while a tie/new review is unresolved.
  const winner = decision.proposals.find((proposal) => proposal.id === result.winnerId)!;
  const payload = campusProposalSchema.parse(winner.payload);
  if (decision.acceptedProposalId !== winner.id) {
    await tx.campusDecision.update({ where: { id: decisionId }, data: { acceptedProposalId: winner.id, acceptedAt: new Date() } });
  }
  if (payload.kind === "LOCATION") {
    await tx.college.update({ where: { id: decision.collegeId }, data: { latitude: payload.latitude, longitude: payload.longitude, address: payload.address } });
  }
}

export async function refreshCampusDecisions(tx: Tx, decisionIds: string[]) {
  for (const id of [...new Set(decisionIds)].sort()) {
    const decision = await tx.campusDecision.findUnique({ where: { id }, select: { collegeId: true } });
    if (!decision) continue;
    await tx.college.update({ where: { id: decision.collegeId }, data: { updatedAt: new Date() } });
    await reconcile(tx, id);
  }
}

export async function getCampusConsensus(collegeId: string, viewer: Pick<CurrentUser, "id"> | null): Promise<ConsensusBoard> {
  const [college, decisions] = await Promise.all([
    prisma.college.findUnique({ where: { id: collegeId }, select: { latitude: true, longitude: true, address: true } }),
    prisma.campusDecision.findMany({
      where: { collegeId }, orderBy: [{ kind: "asc" }, { updatedAt: "desc" }],
      include: {
        proposals: { orderBy: { createdAt: "asc" }, include: { _count: { select: { votes: { where: { user: { is: { isSuspended: false } } } } } } } },
        votes: { where: { userId: viewer?.id ?? "000000000000000000000000" }, select: { proposalId: true } },
      },
    }),
  ]);
  if (!college) throw new ApiError(404, "NOT_FOUND", "Campus not found.");
  return {
    location: college,
    decisions: decisions.map((decision) => {
      const tally = evaluateConsensus(decision.proposals.map((proposal) => ({ id: proposal.id, votes: proposal._count.votes })));
      return {
        id: decision.id, kind: decision.kind, title: decision.title,
        acceptedProposalId: decision.acceptedProposalId, acceptedAt: decision.acceptedAt?.toISOString() ?? null,
        ...tally, myVote: viewer ? decision.votes[0]?.proposalId ?? null : null,
        proposals: decision.proposals.map((proposal) => ({ id: proposal.id, payload: campusProposalSchema.parse(proposal.payload), votes: proposal._count.votes, share: tally.totalVotes ? Math.round(proposal._count.votes / tally.totalVotes * 100) : 0 })),
      };
    }),
  };
}

export async function proposeCampusDecision(user: CurrentUser, collegeId: string, raw: CampusProposalInput) {
  const input = campusProposalSchema.parse(raw);
  const texts = input.kind === "LOCATION" ? [input.address] : [input.company, input.departments, input.eligibility];
  await requireSafePublicContent(user.id, "CAMPUS_REVIEW", texts);
  await transaction(async (tx) => {
    const college = await tx.college.findUnique({ where: { id: collegeId }, select: { id: true } });
    if (!college) throw new ApiError(404, "NOT_FOUND", "Campus not found.");
    await requireMember(tx, user, collegeId);
    // Serialize proposals/votes with campus edits before reading tallies.
    await tx.college.update({ where: { id: collegeId }, data: { updatedAt: new Date() } });
    const key = input.kind === "LOCATION" ? "location" : `placement:${hash(`${input.company.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()}:${input.academicYear}`)}`;
    let decision = await tx.campusDecision.findUnique({ where: { collegeId_key: { collegeId, key } } });
    if (!decision) {
      if (await tx.campusDecision.count({ where: { collegeId } }) >= 50) throw new ApiError(422, "REVIEW_LIMIT", "This campus has reached its active review limit.");
      decision = await tx.campusDecision.create({ data: { collegeId, key, kind: input.kind, title: input.kind === "LOCATION" ? "Campus location" : `${input.company} · ${input.academicYear}` } });
    }
    const fingerprint = hash(input.kind === "LOCATION" ? JSON.stringify([input.latitude, input.longitude]) : JSON.stringify(input));
    let proposal = await tx.campusProposal.findUnique({ where: { decisionId_fingerprint: { decisionId: decision.id, fingerprint } } });
    if (!proposal) {
      if (await tx.campusProposal.count({ where: { decisionId: decision.id } }) >= 20) throw new ApiError(422, "PROPOSAL_LIMIT", "Choose an existing proposal; this review already has 20 alternatives.");
      proposal = await tx.campusProposal.create({ data: { decisionId: decision.id, fingerprint, payload: input } });
    }
    await tx.campusDecisionVote.upsert({ where: { decisionId_userId: { decisionId: decision.id, userId: user.id } }, create: { decisionId: decision.id, userId: user.id, proposalId: proposal.id }, update: { proposalId: proposal.id } });
    await tx.campusDecision.update({ where: { id: decision.id }, data: { revision: { increment: 1 } } });
    await reconcile(tx, decision.id);
  });
  return getCampusConsensus(collegeId, user);
}

export async function voteCampusDecision(user: CurrentUser, collegeId: string, decisionId: string, proposalId: string | null) {
  await transaction(async (tx) => {
    const decision = await tx.campusDecision.findFirst({ where: { id: decisionId, collegeId } });
    if (!decision) throw new ApiError(404, "NOT_FOUND", "Campus review not found.");
    if (proposalId) await requireMember(tx, user, collegeId);
    await tx.college.update({ where: { id: collegeId }, data: { updatedAt: new Date() } });
    if (proposalId) {
      if (!await tx.campusProposal.findFirst({ where: { id: proposalId, decisionId } })) throw new ApiError(422, "INVALID_PROPOSAL", "Choose a proposal from this review.");
      await tx.campusDecisionVote.upsert({ where: { decisionId_userId: { decisionId, userId: user.id } }, create: { decisionId, userId: user.id, proposalId }, update: { proposalId } });
    } else await tx.campusDecisionVote.deleteMany({ where: { decisionId, userId: user.id } });
    await tx.campusDecision.update({ where: { id: decisionId }, data: { revision: { increment: 1 } } });
    await reconcile(tx, decisionId);
  });
  return getCampusConsensus(collegeId, user);
}
