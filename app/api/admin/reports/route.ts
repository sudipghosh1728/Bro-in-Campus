import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, fail, ok, pageSize } from "@/lib/api";
import { requireRole, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReportStatus, Role } from "@/lib/domain";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    requireRole(user, [Role.ADMIN, Role.MODERATOR]);
    const reports = await prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: pageSize(request.nextUrl.searchParams.get("take")), include: { reporter: { select: { id: true, name: true, username: true } } } });
    return ok(reports.map((report) => ({ ...report, createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString(), resolvedAt: report.resolvedAt?.toISOString() ?? null })));
  } catch (error) { return fail(error); }
}

const statusSchema = z.object({ status: z.enum([ReportStatus.OPEN, ReportStatus.REVIEWING, ReportStatus.RESOLVED, ReportStatus.DISMISSED]) });
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request);
    requireRole(user, [Role.ADMIN, Role.MODERATOR]);
    const reportId = request.nextUrl.searchParams.get("id");
    if (!reportId) throw new ApiError(422, "VALIDATION_ERROR", "Report id is required.");
    const { status } = statusSchema.parse(await request.json());
    const report = await prisma.report.update({ where: { id: reportId }, data: { status, resolvedBy: status === ReportStatus.OPEN || status === ReportStatus.REVIEWING ? null : user.id, resolvedAt: status === ReportStatus.OPEN || status === ReportStatus.REVIEWING ? null : new Date() } });
    return ok({ ...report, createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString() });
  } catch (error) { return fail(error); }
}
