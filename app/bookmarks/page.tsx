import { redirect } from "next/navigation";
import { BookmarksClient } from "@/components/BookmarksClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getBookmarks } from "@/lib/community";

export default async function BookmarksPage() {
  let currentUser;
  try { currentUser = await getCurrentUser(); } catch { return <DatabaseRequired />; }
  if (!currentUser) redirect("/login?next=/bookmarks");
  try {
    const bookmarks = await getBookmarks(currentUser);
    const user = { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null };
    return <BookmarksClient initialBookmarks={bookmarks} user={user} />;
  } catch { return <DatabaseRequired />; }
}
