import { notFound } from "next/navigation";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { UserProfileClient } from "@/components/UserProfileClient";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProfile } from "@/lib/community";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  let currentUser;
  let profile;
  try {
    currentUser = await getCurrentUser();
    profile = await getPublicProfile((await params).username, currentUser);
  } catch { return <DatabaseRequired />; }
  if (!profile) notFound();
  const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null } : null;
  return <UserProfileClient profile={profile} user={user} />;
}
