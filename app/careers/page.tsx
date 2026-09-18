import { CareerClient } from "@/components/CareerClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getCareerDirectory } from "@/lib/campus";

export default async function CareersPage() {
  try {
    const currentUser = await getCurrentUser();
    const data = await getCareerDirectory(currentUser);
    const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null } : null;
    return <CareerClient initialData={data} user={user} />;
  } catch { return <DatabaseRequired />; }
}
