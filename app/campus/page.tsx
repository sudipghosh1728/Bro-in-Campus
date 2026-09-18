import { CampusClient } from "@/components/CampusClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getCampusOverview } from "@/lib/campus";

export default async function CampusPage() {
  try {
    const currentUser = await getCurrentUser();
    const data = await getCampusOverview(currentUser);
    const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null } : null;
    return <CampusClient initialData={data} user={user} />;
  } catch { return <DatabaseRequired />; }
}
