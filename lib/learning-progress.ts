import { Prisma } from "@prisma/client";
import { ApiError } from "./api";
import { learningMilestones, progressSummary } from "./learning-paths";
import { prisma } from "./prisma";

async function getPath(id: string) {
  const path = await prisma.learningPath.findUnique({ where: { id }, select: { milestones: true } });
  if (!path) throw new ApiError(404, "NOT_FOUND", "Learning pathway not found.");
  return learningMilestones(path.milestones);
}

export async function getLearningProgress(userId: string, learningPathId: string) {
  const [milestones, record] = await Promise.all([
    getPath(learningPathId),
    prisma.learningPathProgress.findUnique({ where: { userId_learningPathId: { userId, learningPathId } } }),
  ]);
  return { progress: progressSummary(record, milestones) };
}

export async function saveLearningProgress(userId: string, learningPathId: string, completedMilestones: string[]) {
  // MongoDB transactions can conflict when two tabs save together. Retry the entire
  // operation, preserving a single per-account record and its first completion date.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const path = await tx.learningPath.findUnique({ where: { id: learningPathId }, select: { milestones: true } });
        if (!path) throw new ApiError(404, "NOT_FOUND", "Learning pathway not found.");
        const milestones = learningMilestones(path.milestones);
        if (!milestones.length) throw new ApiError(422, "NO_MILESTONES", "This pathway does not have a checklist yet.");
        const selected = new Set(completedMilestones);
        if ([...selected].some((id) => !milestones.some((milestone) => milestone.id === id))) {
          throw new ApiError(422, "INVALID_MILESTONE", "This pathway has changed. Refresh it before saving your checklist.");
        }
        const completed = milestones.filter((milestone) => selected.has(milestone.id)).map((milestone) => milestone.id);
        const progress = Math.round(completed.length / milestones.length * 100);
        const where = { userId_learningPathId: { userId, learningPathId } };
        const existing = await tx.learningPathProgress.findUnique({ where });
        const data = { completedMilestones: completed, progress, completedAt: progress === 100 ? existing?.completedAt ?? new Date() : null };
        const record = existing
          ? await tx.learningPathProgress.update({ where: { id: existing.id }, data })
          : await tx.learningPathProgress.create({ data: { userId, learningPathId, ...data } });
        return { progress: progressSummary(record, milestones)! };
      }, { maxWait: 5000, timeout: 15000 });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2002", "P2034"].includes(error.code)) throw error;
      if (attempt === 2) throw new ApiError(409, "PROGRESS_CONFLICT", "Another save is in progress. Please try again.");
    }
  }
  throw new ApiError(409, "PROGRESS_CONFLICT", "Please try saving again.");
}
