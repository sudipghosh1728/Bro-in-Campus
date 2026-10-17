import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const baseUrl = "https://broincampus.in";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = ["", "/colleges", "/students", "/community", "/campus", "/careers", "/learn", "/discover"].map((path) => ({ url: `${baseUrl}${path}`, lastModified: new Date(), changeFrequency: path === "" ? "daily" : "weekly", priority: path === "" ? 1 : 0.8 }));
  try {
    const colleges = await prisma.college.findMany({ select: { slug: true, updatedAt: true }, take: 500, orderBy: { updatedAt: "desc" } });
    return [...staticPages, ...colleges.map((college) => ({ url: `${baseUrl}/colleges/${college.slug}`, lastModified: college.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 }))];
  } catch (error) {
    console.error("Sitemap college lookup failed", error);
    return staticPages;
  }
}
