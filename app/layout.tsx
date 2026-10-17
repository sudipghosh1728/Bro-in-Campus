import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { PlatformHeader } from "@/components/PlatformHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://broincampus.in"),
  title: { default: "Bro in Campus — India's student community", template: "%s | Bro in Campus" },
  description: "India's student community for campuses, learning roadmaps, opportunities, scholarships and practical college life.",
  keywords: ["student community India", "college events", "student scholarships", "learning roadmaps", "campus opportunities", "Bro in Campus"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "en_IN", url: "/", siteName: "Bro in Campus", title: "Bro in Campus — India's student community", description: "Find your campus, build your roadmap and act on the opportunities around you.", images: [{ url: "/brand/bro-in-campus-logo.png", width: 1200, height: 630, alt: "Bro in Campus" }] },
  twitter: { card: "summary_large_image", title: "Bro in Campus — India's student community", description: "Find your campus, build your roadmap and act on the opportunities around you." },
  icons: {
    icon: "/brand/bro-in-campus-logo-transparent.png",
    apple: "/brand/bro-in-campus-logo-transparent.png",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const currentUser = await getCurrentUser().catch(() => null);
  const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null, profession: currentUser.profile?.profession ?? null } : null;
  return (
    <html lang="en-IN">
      <body><PlatformHeader user={user} />{children}</body>
    </html>
  );
}
