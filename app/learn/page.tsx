import type { Metadata } from "next";
import { GrowthHubClient } from "@/components/GrowthHubClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getGrowthOverview } from "@/lib/growth";
import { getCachedGrowthCatalog } from "@/lib/public-catalog-cache";

export const metadata: Metadata = {
  title: "Learning roadmaps, scholarships and student briefing",
  description: "Explore department-aware learning pathways, student scholarships and concise signals for your next semester.",
  alternates: { canonical: "/learn" },
  openGraph: { title: "Your next semester starts here", description: "Department-aware learning pathways, scholarships and the student briefing.", url: "/learn" },
};

export default async function LearnPage({ searchParams }: { searchParams: Promise<{ department?: string }> }) {
  try {
    const user = await getCurrentUser();
    const { department } = await searchParams;
    return <GrowthHubClient key={`${user?.id ?? "guest"}:${department ?? "all"}`} initialData={await getGrowthOverview(user, getCachedGrowthCatalog())} initialEmail={user?.email ?? ""} initialDepartment={department} signedIn={Boolean(user && !user.isSuspended)} />;
  } catch (error) {
    console.error("Growth hub data load failed", error);
    return <DatabaseRequired />;
  }
}
