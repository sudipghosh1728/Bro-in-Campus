import { notFound } from "next/navigation";
import { CompanyProfileClient } from "@/components/CompanyProfileClient";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/campus";

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  let company;
  let currentUser;
  try {
    currentUser = await getCurrentUser();
    company = await getCompanyProfile((await params).slug, currentUser);
  } catch { return <DatabaseRequired />; }
  if (!company) notFound();
  const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null } : null;
  return <CompanyProfileClient company={company} user={user} />;
}
