import { notFound } from "next/navigation";
import { CollegeDetailClient } from "@/components/CollegeDetailClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getCollegeDetail, getDepartmentCatalog } from "@/lib/colleges";
import { getResidenceLivingData } from "@/lib/living";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { getCampusConsensus } from "@/lib/campus-consensus";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const college = await prisma.college.findUnique({ where: { slug }, select: { name: true, city: true } }).catch(() => null);
  if (!college) return { title: "Campus unavailable", robots: { index: false, follow: true } };
  return {
    title: `${college.name} student community`,
    description: `Connect with the community at ${college.name}, ${college.city}. Explore academic groups, campus updates and shared student support.`,
    alternates: { canonical: `/colleges/${encodeURIComponent(slug)}` },
    openGraph: { title: `${college.name} student community`, url: `/colleges/${encodeURIComponent(slug)}` },
  };
}

export default async function CollegeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const currentUser = await getCurrentUser();
    const college = await getCollegeDetail(slug, currentUser);
    if (!college) notFound();
    const canEdit = currentUser && (college.listedBy?.id === currentUser.id || ["ADMIN", "MODERATOR"].includes(currentUser.role));
    const [living, departments, consensus] = await Promise.all([getResidenceLivingData(college.id, currentUser), canEdit ? getDepartmentCatalog() : Promise.resolve([]), getCampusConsensus(college.id, currentUser)]);
    const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null, profession: currentUser.profile?.profession ?? null } : null;
    return <CollegeDetailClient initialCollege={college} departmentCatalog={departments} initialLiving={living} initialConsensus={consensus} user={user} />;
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return <DatabaseRequired />;
  }
}
