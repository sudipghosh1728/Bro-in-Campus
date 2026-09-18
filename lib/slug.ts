import { prisma } from "./prisma";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72) || "question";
}

export async function uniqueQuestionSlug(title: string) {
  const base = slugify(title);
  let candidate = base;
  let attempt = 2;
  while (await prisma.question.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${attempt}`;
    attempt += 1;
  }
  return candidate;
}
