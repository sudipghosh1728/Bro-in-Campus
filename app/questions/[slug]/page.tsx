import { notFound } from "next/navigation";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { QuestionDetailClient } from "@/components/QuestionDetailClient";
import { getCurrentUser } from "@/lib/auth";
import { getQuestionBySlug } from "@/lib/community";

export default async function QuestionPage({ params }: { params: Promise<{ slug: string }> }) {
  let question;
  let currentUser;
  try {
    currentUser = await getCurrentUser();
    question = await getQuestionBySlug((await params).slug, currentUser);
  } catch { return <DatabaseRequired />; }
  if (!question) notFound();
  const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null } : null;
  return <QuestionDetailClient initialQuestion={question} user={user} />;
}
