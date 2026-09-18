import { redirect } from "next/navigation";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { NotificationsClient } from "@/components/NotificationsClient";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications } from "@/lib/community";

export default async function NotificationsPage() {
  let currentUser;
  try { currentUser = await getCurrentUser(); } catch { return <DatabaseRequired />; }
  if (!currentUser) redirect("/login?next=/notifications");
  try {
    const data = await getNotifications(currentUser.id);
    return <NotificationsClient initialNotifications={data.notifications} initialUnreadCount={data.unreadCount} />;
  } catch { return <DatabaseRequired />; }
}
