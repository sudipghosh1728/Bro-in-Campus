"use client";

import Link from "next/link";
import { subscribeToRefresh } from "@/lib/live-refresh";
import { Bell, LogOut, Menu, MessageCircleQuestion, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "./BrandLogo";
import type { Viewer } from "@/lib/types";

export function PlatformHeader({ user }: { user: Viewer }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const response = await fetch("/api/notifications");
      if (response.ok) setUnread((await response.json()).data.unreadCount);
    };
    load();
    return subscribeToRefresh(load);
  }, [user]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links = [
    ["Home", "/"],
    ["Campus", "/colleges"],
    ["People", "/students"],
    ["Community", "/community"],
  ];
  return <header className="app-header">
    <div className="app-header__inner">
      <Link href="/" className="app-brand"><BrandLogo /></Link>
      <nav className={open ? "app-nav app-nav--open" : "app-nav"} aria-label="Primary navigation">
        {links.map(([label, href]) => <Link key={href} className={pathname === href ? "active" : ""} href={href} onClick={() => setOpen(false)}>{label}</Link>)}
        {user && user.role !== "USER" && <Link className={pathname === "/admin" ? "active" : ""} href="/admin" onClick={() => setOpen(false)}>Admin</Link>}
      </nav>
      <div className="app-header__actions">
        <Link className="header-search" href="/community?focus=search" aria-label="Search campus discussions"><Search size={18} /><span>Search</span></Link>
        {user ? <>
          <Link className="notification-link" href="/notifications" aria-label="Notifications"><Bell size={19} />{unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}</Link>
          <Link className="header-saved" href="/bookmarks" aria-label="Saved conversations"><MessageCircleQuestion size={18} /></Link>
          <Link className="user-chip" href="/settings/profile"><span>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.name.slice(0, 2).toUpperCase()}</span><i>{user.name.split(" ")[0]}</i></Link>
          <button className="header-logout" onClick={logout} aria-label="Log out"><LogOut size={17} /></button>
        </> : <>
          <Link className="header-signin" href="/login">Sign in</Link>
          <Link className="header-ask" href="/register">Join campus</Link>
        </>}
        <button className="header-menu" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button>
      </div>
    </div>
  </header>;
}
