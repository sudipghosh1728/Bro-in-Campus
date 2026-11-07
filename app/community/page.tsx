import { DatabaseRequired } from "@/components/DatabaseRequired";
import { DiscoverClient } from "@/components/DiscoverClient";
import { getCurrentUser } from "@/lib/auth";
import { getDiscoverFeed } from "@/lib/community";

export const metadata = {
  title: "Campus conversations and student channels",
  description: "Join useful student conversations, explore topic channels and connect with your campus community on Bro in Campus.",
  alternates: { canonical: "/community" },
  openGraph: { title: "Campus conversations | Bro in Campus", url: "/community" },
};

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string; sort?: string; focus?: string }> }) {
  try {
    const params = await searchParams;
    const sort = params.sort === "latest" || params.sort === "trending" ? params.sort : "recommended";
    const currentUser = await getCurrentUser();
    const data = await getDiscoverFeed(currentUser, { sort, q: params.q, topic: params.topic });
    const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null } : null;
    return <DiscoverClient initialData={data} user={user} initialFilters={{ sort, query: params.q ?? "", topic: params.topic ?? null, focusSearch: params.focus === "search" }} />;
  } catch { return <DatabaseRequired />; }
}
