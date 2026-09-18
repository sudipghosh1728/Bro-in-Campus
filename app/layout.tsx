import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { PlatformHeader } from "@/components/PlatformHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bro in Campus — Your campus, connected.",
  description:
    "Discover your college, find your people, and make campus life easier with Bro in Campus.",
  icons: {
    icon: "/brand/bro-in-campus-logo-transparent.png",
    apple: "/brand/bro-in-campus-logo-transparent.png",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const currentUser = await getCurrentUser().catch(() => null);
  const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null, profession: currentUser.profile?.profession ?? null } : null;
  return (
    <html lang="en">
      <body><PlatformHeader user={user} />{children}</body>
    </html>
  );
}
