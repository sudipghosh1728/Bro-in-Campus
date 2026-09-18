import { notFound } from "next/navigation";
import { CollegeDetailClient } from "@/components/CollegeDetailClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getCollegeDetail } from "@/lib/colleges";
import { getResidenceLivingData } from "@/lib/living";

export default async function CollegeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const currentUser = await getCurrentUser();
    const college = await getCollegeDetail(slug, currentUser);
    if (!college) notFound();
    const living = await getResidenceLivingData(college.id, currentUser);
    const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null, profession: currentUser.profile?.profession ?? null } : null;
    return <CollegeDetailClient initialCollege={college} initialLiving={living} user={user} />;
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return <DatabaseRequired />;
  }
}
