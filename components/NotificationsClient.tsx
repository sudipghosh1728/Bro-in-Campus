"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { NotificationItem } from "@/lib/types";
import { Avatar } from "./Avatar";

export function NotificationsClient({ initialNotifications, initialUnreadCount }: { initialNotifications: NotificationItem[]; initialUnreadCount: number }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [message, setMessage] = useState("");

  async function read(id: string) {
    const item = notifications.find((notification) => notification.id === id);
    if (!item || item.readAt) return;
    setNotifications((items) => items.map((notification) => notification.id === id ? { ...notification, readAt: new Date().toISOString() } : notification));
    setUnreadCount((count) => Math.max(0, count - 1));
    try { await api(`/api/notifications/${id}/read`, { method: "PATCH" }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update notification."); }
  }

  async function readAll() {
    if (!unreadCount) return;
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    try { await api("/api/notifications", { method: "PATCH" }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update notifications."); }
  }

  return <main className="platform-page utility-page">
    <div className="utility-heading"><div><p className="section-kicker"><Bell size={14} /> Activity</p><h1>Notifications</h1><p>Replies, follows and updates from your campus network.</p></div>{unreadCount > 0 && <button className="button button--dark compact-button" onClick={readAll}><CheckCheck size={16} /> Mark all read</button>}</div>
    {message && <p className="inline-error">{message}</p>}
    <section className="notification-list">{notifications.length ? notifications.map((item) => {
      const href = item.type === "ANSWER_CREATED" && item.entityId ? `/questions/${item.entityId}` : item.type === "USER_FOLLOWED" && item.actor ? `/u/${item.actor.username}` : (item.type === "CAMPUS_ISSUE_REPORTED" || item.type === "CAMPUS_ISSUE_RESOLVED") && item.entityId ? `/colleges/${item.entityId}` : "/discover";
      return <Link className={item.readAt ? "notification-item" : "notification-item unread"} href={href} key={item.id} onClick={() => read(item.id)}>
        {item.actor ? <Avatar name={item.actor.name} src={item.actor.avatarUrl} /> : <span className="notification-icon"><Bell size={17} /></span>}
        <span><b>{item.message}</b><small>{new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round((new Date(item.createdAt).getTime() - Date.now()) / 3_600_000), "hour")}</small></span>{!item.readAt && <i aria-label="Unread" />}
      </Link>;
    }) : <div className="empty-state utility-empty"><h2>Nothing new yet.</h2><p>When people interact with your contributions, you&apos;ll see it here.</p><Link className="button button--red" href="/discover">Explore community</Link></div>}</section>
  </main>;
}
