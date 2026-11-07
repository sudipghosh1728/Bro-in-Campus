import { CollegeDirectoryClient } from "@/components/CollegeDirectoryClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getCollegeDirectory } from "@/lib/colleges";
import { getCachedDepartmentCatalog } from "@/lib/public-catalog-cache";

export const metadata = {
  title: "College communities across India",
  description: "Find your college community, explore academic groups and connect with students who share your campus.",
  alternates: { canonical: "/colleges" },
};

export default async function CollegesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  try {
    const params = await searchParams;
    const currentUser = await getCurrentUser();
    const [data, departments] = await Promise.all([getCollegeDirectory(currentUser, { q: params.q }), getCachedDepartmentCatalog()]);
    const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null, profession: currentUser.profile?.profession ?? null } : null;
    return <CollegeDirectoryClient initialData={data} departments={departments} user={user} initialQuery={params.q ?? ""} />;
  } catch { return <DatabaseRequired />; }
}
