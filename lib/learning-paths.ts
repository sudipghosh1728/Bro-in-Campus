import { createHash } from "node:crypto";
import type { LearningMilestone, LearningProgress } from "./growth-types";

const departmentSignals: Record<string, string[]> = {
  "computing-ai": ["computer", "computing", "cse", "software", "information technology", "it", "ai", "data", "electronics"],
  "core-engineering": ["mechanical", "civil", "electrical", "chemical", "engineering"],
  "business-commerce": ["business", "commerce", "management", "mba", "finance", "economics"],
  "design-media": ["design", "architecture", "media", "animation", "fashion", "fine arts"],
  "health-life-sciences": ["medical", "nursing", "pharmacy", "biotech", "biology", "life science"],
  "humanities-law": ["law", "humanities", "political", "psychology", "sociology", "english"],
  "science-research": ["physics", "mathematics", "statistics", "chemistry", "science"],
};

// Match whole words/phrases, not e.g. "it" in "hospitality" or "ai" in "retail".
export function scoreForDepartment(slug: string, profile: { course: string | null; interests: string[] } | null) {
  if (!profile) return 0;
  const fields = [profile.course ?? "", ...profile.interests].map((field) => ` ${field.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `);
  return (departmentSignals[slug] ?? []).reduce((score, signal) => score + (fields.some((field) => field.includes(` ${signal} `)) ? 3 : 0), 0);
}

export function learningMilestones(value: unknown): LearningMilestone[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, LearningMilestone>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { title, outcome } = item as { title?: unknown; outcome?: unknown };
    if (typeof title !== "string" || typeof outcome !== "string" || !title.trim() || !outcome.trim()) continue;
    // Content-derived keys survive reordering; revised milestones must be done again.
    const id = createHash("sha256").update(JSON.stringify([title.trim(), outcome.trim()])).digest("hex").slice(0, 24);
    unique.set(id, { id, title: title.trim(), outcome: outcome.trim() });
  }
  return [...unique.values()];
}

export function progressSummary(record: {
  completedMilestones: string[];
  startedAt: Date;
  completedAt: Date | null;
} | null, milestones: LearningMilestone[]): LearningProgress | null {
  if (!record) return null;
  const completed = new Set(record.completedMilestones);
  const completedMilestones = milestones.filter((milestone) => completed.has(milestone.id)).map((milestone) => milestone.id);
  const progress = milestones.length ? Math.round(completedMilestones.length / milestones.length * 100) : 0;
  return {
    completedMilestones, progress,
    startedAt: record.startedAt.toISOString(),
    completedAt: progress === 100 ? record.completedAt?.toISOString() ?? null : null,
  };
}
