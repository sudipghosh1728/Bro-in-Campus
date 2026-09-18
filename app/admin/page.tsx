import { notFound, redirect } from "next/navigation";
import { AdminClient } from "@/components/AdminClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { Role } from "@/lib/domain";

export default async function AdminPage() {
  let currentUser;
  try { currentUser = await getCurrentUser(); } catch { return <DatabaseRequired />; }
  if (!currentUser) redirect("/login?next=/admin");
  if (currentUser.role !== Role.ADMIN && currentUser.role !== Role.MODERATOR) notFound();
  const user = { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null };
  return <AdminClient user={user} />;
}
