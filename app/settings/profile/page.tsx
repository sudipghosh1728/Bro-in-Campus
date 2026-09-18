import { redirect } from "next/navigation";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { ProfileSettingsClient } from "@/components/ProfileSettingsClient";
import { getCurrentUser } from "@/lib/auth";

export default async function ProfileSettingsPage() {
  let currentUser;
  try { currentUser = await getCurrentUser(); } catch { return <DatabaseRequired />; }
  if (!currentUser) redirect("/login?next=/settings/profile");
  return <ProfileSettingsClient initialUser={currentUser} />;
}
