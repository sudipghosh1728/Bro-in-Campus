import { CollegeDirectoryClient } from "@/components/CollegeDirectoryClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getCollegeDirectory } from "@/lib/colleges";

export default async function CollegesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  try {
    const params = await searchParams;
    const currentUser = await getCurrentUser();
    const data = await getCollegeDirectory(currentUser, { q: params.q });
    const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null, profession: currentUser.profile?.profession ?? null } : null;
    return <CollegeDirectoryClient initialData={data} user={user} initialQuery={params.q ?? ""} />;
  } catch { return <DatabaseRequired />; }
}
