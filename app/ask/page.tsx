import { redirect } from "next/navigation";
import { AskQuestionClient } from "@/components/AskQuestionClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AskPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/ask");
  try {
    const topics = await prisma.topic.findMany({ orderBy: { name: "asc" }, take: 30, select: { id: true, name: true, slug: true, description: true } });
    return <AskQuestionClient topics={topics} />;
  } catch { return <DatabaseRequired />; }
}
