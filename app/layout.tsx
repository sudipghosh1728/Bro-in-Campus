import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Mono, DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import "./community.css";
import { getCurrentImpersonation, getCurrentUser } from "@/lib/auth";
import { PlatformHeader } from "@/components/PlatformHeader";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

const sans = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--font-dm-sans" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], display: "swap", preload: false, variable: "--font-dm-mono" });
const serif = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], display: "swap", preload: false, variable: "--font-playfair" });

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
  const [currentUser, impersonation] = await Promise.all([getCurrentUser().catch(() => null), getCurrentImpersonation().catch(() => null)]);
  const user = currentUser ? { id: currentUser.id, name: currentUser.name, username: currentUser.username, role: currentUser.role, avatarUrl: currentUser.profile?.avatarUrl ?? null, profession: currentUser.profile?.profession ?? null } : null;
  return (
    <html lang="en-IN" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body><PlatformHeader user={user} />{impersonation && <ImpersonationBanner adminName={impersonation.adminName} targetName={impersonation.targetName} />}{children}</body>
    </html>
  );
}
