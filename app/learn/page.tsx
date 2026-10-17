import type { Metadata } from "next";
import { GrowthHubClient } from "@/components/GrowthHubClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getGrowthOverview } from "@/lib/growth";

export const metadata: Metadata = {
  title: "Learning roadmaps, scholarships and student briefing",
  description: "Explore department-aware learning pathways, student scholarships and concise signals for your next semester.",
};

export default async function LearnPage() {
  try {
    const user = await getCurrentUser();
    return <GrowthHubClient initialData={await getGrowthOverview(user)} initialEmail={user?.email ?? ""} />;
  } catch (error) {
    console.error("Growth hub data load failed", error);
    return <DatabaseRequired />;
  }
}
