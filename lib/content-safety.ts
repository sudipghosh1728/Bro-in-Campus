import { ApiError } from "./api";
import { prisma } from "./prisma";

export type SafetyCategory = "EXPLICIT_SEXUAL_CONTENT" | "TERRORISM_OR_EXTREMISM";

export type ContentSafetyDecision =
  | { allowed: true; categories: [] }
  | { allowed: false; categories: SafetyCategory[] };

// This lightweight policy intentionally runs on the server before public text
// is written. It provides a dependable baseline even when an external
// moderation provider is unavailable. We do not retain the blocked text.
const blockedPatterns: Array<{ category: SafetyCategory; pattern: RegExp }> = [
  {
    category: "EXPLICIT_SEXUAL_CONTENT",
    pattern: /\b(?:porn(?:ography|ographic)?|porno|xxx|onlyfans|nudes?|sex\s*(?:tape|video|chat|cam|content)|explicit\s+sex|escort(?:ing)?|prostitut(?:e|ion)|rape|molest(?:ed|ation)?|incest)\b/i,
  },
  {
    category: "TERRORISM_OR_EXTREMISM",
    pattern: /\b(?:terroris[tm]|terrorist(?:s)?|violent\s+extremis[tm]|extremist(?:s)?|radicali[sz](?:e|ed|ing|ation)|isis|isil|al[-\s]?qaeda|bomb\s*(?:making|plan|attack)|explosive\s+device|suicide\s+bomb(?:ing|er)?|attack\s+plan)\b/i,
  },
];

function normalise(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[0@]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[$5]/g, "s")
    .replace(/[\-_./]+/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function assessPublicContent(values: Array<string | null | undefined>): ContentSafetyDecision {
  const content = normalise(values.filter((value): value is string => Boolean(value)).join(" "));
  const categories = [...new Set(blockedPatterns.filter(({ pattern }) => pattern.test(content)).map(({ category }) => category))];

  return categories.length ? { allowed: false, categories } : { allowed: true, categories: [] };
}
export async function requireSafePublicContent(userId: string, contentType: string, values: Array<string | null | undefined>) {
  const decision = assessPublicContent(values);
  if (decision.allowed) return;
  // Preserve a category-only audit trail. The rejected text is deliberately
  // never written to the database.
  await prisma.contentModeration.create({ data: { userId, contentType, decision: "BLOCKED", categories: decision.categories } });
  throw new ApiError(422, "CONTENT_BLOCKED", "This submission was blocked by the community safety policy and was not published.");
}
