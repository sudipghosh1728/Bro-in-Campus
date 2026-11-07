import { NextRequest } from "next/server";
import { ApiError, fail, ok } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { Role } from "@/lib/domain";
import { updateCollegeDepartments } from "@/lib/colleges";
import { prisma } from "@/lib/prisma";
import { adminCollegeUpdateSchema, mongoId } from "@/lib/validation";
import { academicPlaceTypes } from "@/lib/growth-types";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const admin = await requireUser(request);
    requireRole(admin, [Role.ADMIN]);
    const id = mongoId.parse((await params).id);
    const input = adminCollegeUpdateSchema.parse(await request.json());
    const college = await prisma.college.findUnique({ where: { id }, select: { id: true, latitude: true, longitude: true, address: true } });
    if (!college) throw new ApiError(404, "NOT_FOUND", "College not found.");
    if ((input.latitude !== undefined && input.latitude !== college.latitude) || (input.longitude !== undefined && input.longitude !== college.longitude) || (input.address !== undefined && (input.address || null) !== college.address)) {
      throw new ApiError(409, "REVIEW_REQUIRED", "Location changes must go through the campus consensus board, including admin edits.");
    }

    if (input.aisheCode) {
      const duplicate = await prisma.college.findFirst({ where: { aisheCode: input.aisheCode, id: { not: id } }, select: { id: true } });
      if (duplicate) throw new ApiError(409, "ALREADY_LISTED", "This AISHE institution already has a place listing.");
    }

    const updated = await prisma.college.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state || null } : {}),
        ...(input.country !== undefined ? { country: input.country || "India" } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.website !== undefined ? { website: input.website || null } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.aisheCode !== undefined ? { aisheCode: input.aisheCode || null, directorySource: input.aisheCode ? "AISHE" : null } : {}),
        ...(input.address !== undefined ? { address: input.address || null } : {}),
        ...(input.buildingCount !== undefined ? { buildingCount: input.buildingCount } : {}),
        ...(input.residentLabel !== undefined ? { residentLabel: input.residentLabel || null } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.coverColor !== undefined ? { coverColor: input.coverColor } : {}),
        ...(input.verified !== undefined ? { verified: input.verified } : {}),
      },
      select: { id: true, slug: true },
    });

    if (input.departmentSlugs !== undefined) {
      await updateCollegeDepartments(admin, id, input.departmentSlugs);
    } else if (input.type && !academicPlaceTypes.includes(input.type)) {
      await prisma.collegeDepartment.deleteMany({ where: { collegeId: id } });
    }
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const admin = await requireUser(request);
    requireRole(admin, [Role.ADMIN]);
    const id = mongoId.parse((await params).id);

    await prisma.$transaction(async (tx) => {
      const college = await tx.college.findUnique({ where: { id }, select: { id: true } });
      if (!college) throw new ApiError(404, "NOT_FOUND", "College not found.");
      const [markets, issues] = await Promise.all([
        tx.localMarket.findMany({ where: { collegeId: id }, select: { id: true } }),
        tx.communityIssue.findMany({ where: { collegeId: id }, select: { id: true } }),
      ]);
      const marketIds = markets.map(({ id: marketId }) => marketId);
      const issueIds = issues.map(({ id: issueId }) => issueId);
      if (marketIds.length) await tx.produceListing.deleteMany({ where: { marketId: { in: marketIds } } });
      if (issueIds.length) await tx.issueVote.deleteMany({ where: { issueId: { in: issueIds } } });
      await tx.localMarket.deleteMany({ where: { collegeId: id } });
      await tx.communityIssue.deleteMany({ where: { collegeId: id } });
      await tx.collegeDepartment.deleteMany({ where: { collegeId: id } });
      await tx.collegeMembership.deleteMany({ where: { collegeId: id } });
      const decisions = await tx.campusDecision.findMany({ where: { collegeId: id }, select: { id: true } });
      const decisionIds = decisions.map((decision) => decision.id);
      await tx.campusDecisionVote.deleteMany({ where: { decisionId: { in: decisionIds } } });
      await tx.campusProposal.deleteMany({ where: { decisionId: { in: decisionIds } } });
      await tx.campusDecision.deleteMany({ where: { collegeId: id } });
      await tx.college.delete({ where: { id } });
    });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
