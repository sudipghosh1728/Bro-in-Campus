import { DatabaseRequired } from "@/components/DatabaseRequired";
import { StudentDirectoryClient } from "@/components/StudentDirectoryClient";
import { getCurrentUser } from "@/lib/auth";
import { getStudentDirectory } from "@/lib/colleges";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; college?: string }> }) {
  try {
    const params = await searchParams;
    const currentUser = await getCurrentUser();
    const data = await getStudentDirectory(currentUser, { q: params.q, college: params.college });
    const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null } : null;
    return <StudentDirectoryClient initialData={data} user={user} initialQuery={params.q ?? ""} />;
  } catch { return <DatabaseRequired />; }
}
