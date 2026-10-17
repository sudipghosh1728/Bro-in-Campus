import { ApiError } from "./api";
import type { CurrentUser } from "./auth";
import { prisma } from "./prisma";

type Viewer = Pick<CurrentUser, "id" | "email" | "profile"> | null;
type Milestone = { title: string; outcome: string };

const departmentSignals: Record<string, string[]> = {
  "computing-ai": ["computer", "software", "information technology", "it", "ai", "data", "electronics"],
  "core-engineering": ["mechanical", "civil", "electrical", "chemical", "engineering"],
  "business-commerce": ["business", "commerce", "management", "mba", "finance", "economics"],
  "design-media": ["design", "architecture", "media", "animation", "fashion", "fine arts"],
  "health-life-sciences": ["medical", "nursing", "pharmacy", "biotech", "biology", "life science"],
  "humanities-law": ["law", "humanities", "political", "psychology", "sociology", "english"],
  "science-research": ["physics", "mathematics", "statistics", "chemistry", "science"],
};

function scoreForDepartment(departmentSlug: string, profile: CurrentUser["profile"]) {
  if (!profile) return 0;
  const haystack = `${profile.course ?? ""} ${profile.interests.join(" ")}`.toLowerCase();
  return (departmentSignals[departmentSlug] ?? []).reduce((score, signal) => score + (haystack.includes(signal) ? 3 : 0), 0);
}

function milestones(value: unknown): Milestone[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || !("title" in item) || !("outcome" in item)) return [];
    const { title, outcome } = item as { title?: unknown; outcome?: unknown };
    return typeof title === "string" && typeof outcome === "string" ? [{ title, outcome }] : [];
  });
}

export async function getGrowthOverview(viewer: Viewer) {
  const [departments, paths, scholarships, briefings] = await Promise.all([
    prisma.department.findMany({ orderBy: [{ demandSignal: "desc" }, { name: "asc" }] }),
    prisma.learningPath.findMany({ orderBy: [{ featured: "desc" }, { trendScore: "desc" }], take: 18 }),
    prisma.scholarship.findMany({
      where: { OR: [{ deadline: { gte: new Date() } }, { deadline: null }, { deadline: { isSet: false } }] },
      orderBy: [{ featured: "desc" }, { deadline: "asc" }],
      take: 18,
    }),
    prisma.newsBriefing.findMany({ orderBy: { publishedAt: "desc" }, take: 12 }),
  ]);
  const rankedPaths = paths
    .map((path) => ({ ...path, fitScore: scoreForDepartment(path.departmentSlug, viewer?.profile ?? null) }))
    .sort((left, right) => right.fitScore - left.fitScore || Number(right.featured) - Number(left.featured) || right.trendScore - left.trendScore);
  const hasProfileSignal = Boolean(viewer?.profile?.course || viewer?.profile?.interests.length);

  return {
    recommendationLabel: hasProfileSignal ? `Matched to ${viewer?.profile?.course || "your interests"}` : "Popular across student communities",
    departments: departments.map((department) => ({ id: department.id, name: department.name, slug: department.slug, synopsis: department.synopsis, focusAreas: department.focusAreas, accent: department.accent, demandSignal: department.demandSignal })),
    paths: rankedPaths.map((path) => ({
      id: path.id, title: path.title, slug: path.slug, departmentSlug: path.departmentSlug, level: path.level, duration: path.duration,
      description: path.description, skills: path.skills, milestones: milestones(path.milestones), trendScore: path.trendScore, featured: path.featured, fitScore: path.fitScore,
    })),
    scholarships: scholarships.map((scholarship) => ({ ...scholarship, deadline: scholarship.deadline?.toISOString() ?? null })),
    briefings: briefings.map((briefing) => ({ ...briefing, publishedAt: briefing.publishedAt.toISOString() })),
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
