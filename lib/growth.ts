import { ApiError } from "./api";
import type { CurrentUser } from "./auth";
import { prisma } from "./prisma";
import { learningMilestones, progressSummary, scoreForDepartment } from "./learning-paths";

type Viewer = Pick<CurrentUser, "id" | "email" | "profile"> | null;

// This loader contains catalog data only. Account progress is deliberately kept
// outside it so pages can cache the catalog without sharing private checklists.
export async function loadGrowthCatalog() {
  const [departments, paths, scholarships, briefings] = await Promise.all([
    prisma.department.findMany({ orderBy: [{ demandSignal: "desc" }, { name: "asc" }] }),
    prisma.learningPath.findMany({
      orderBy: [{ featured: "desc" }, { trendScore: "desc" }],
    }),
    prisma.scholarship.findMany({
      where: { OR: [{ deadline: { gte: new Date() } }, { deadline: null }, { deadline: { isSet: false } }] },
      orderBy: [{ featured: "desc" }, { deadline: "asc" }],
      take: 18,
    }),
    prisma.newsBriefing.findMany({ orderBy: { publishedAt: "desc" }, take: 12 }),
  ]);
  return {
    departments: departments.map(({ id, name, slug, synopsis, focusAreas, accent, demandSignal }) => ({ id, name, slug, synopsis, focusAreas, accent, demandSignal })),
    paths: paths.map(({ id, title, slug, departmentSlug, level, duration, description, skills, milestones, trendScore, featured }) => ({ id, title, slug, departmentSlug, level, duration, description, skills, milestones: learningMilestones(milestones), trendScore, featured })),
    scholarships: scholarships.map(({ id, title, slug, provider, description, amount, eligibility, categories, applicationUrl, deadline, featured }) => ({ id, title, slug, provider, description, amount, eligibility, categories, applicationUrl, deadline: deadline?.toISOString() ?? null, featured })),
    briefings: briefings.map(({ id, title, slug, summary, category, sourceName, sourceUrl, publishedAt, featured }) => ({ id, title, slug, summary, category, sourceName, sourceUrl, publishedAt: publishedAt.toISOString(), featured })),
  };
}

export async function getGrowthOverview(viewer: Viewer, catalogPromise = loadGrowthCatalog()) {
  const [{ departments, paths, scholarships, briefings }, progressRecords] = await Promise.all([
    catalogPromise,
    viewer ? prisma.learningPathProgress.findMany({ where: { userId: viewer.id } }) : Promise.resolve([]),
  ]);
  const progressByPath = new Map(progressRecords.map((record) => [record.learningPathId, record]));
  const rankedPaths = paths
    .map((path) => ({ ...path, fitScore: scoreForDepartment(path.departmentSlug, viewer?.profile ?? null) }))
    .sort((left, right) => right.fitScore - left.fitScore || Number(right.featured) - Number(left.featured) || right.trendScore - left.trendScore);
  const hasProfileSignal = rankedPaths.some((path) => path.fitScore > 0);

  return {
    recommendationLabel: hasProfileSignal ? "Matched to your course and interests" : "Explore the curated learning collection",
    departments,
    paths: rankedPaths.map((path) => ({
      id: path.id, title: path.title, slug: path.slug, departmentSlug: path.departmentSlug, level: path.level, duration: path.duration,
      description: path.description, skills: path.skills, milestones: path.milestones, fitScore: path.fitScore,
      progress: viewer ? progressSummary(progressByPath.get(path.id) ?? null, path.milestones) : null,
    })),
    // A cached listing must still disappear immediately after its deadline.
    scholarships: scholarships.filter((item) => !item.deadline || new Date(item.deadline) >= new Date()),
    briefings,
  };
}

export async function subscribeToNewsletter(input: { email: string; interests: string[]; userId?: string }) {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new ApiError(422, "VALIDATION_ERROR", "Enter an email address to receive the briefing.");
  await prisma.newsletterSubscription.upsert({
    where: { email },
    create: { email, interests: input.interests, userId: input.userId ?? null, status: "ACTIVE" },
    update: { interests: input.interests, userId: input.userId ?? null, status: "ACTIVE" },
  });
  return { email, status: "ACTIVE" as const };
}
