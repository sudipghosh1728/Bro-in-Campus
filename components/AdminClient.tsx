"use client";

import { Search, ShieldCheck, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
import type { Viewer } from "@/lib/types";

type Analytics = { metrics: { users: number; questions: number; answers: number; comments: number; reports: number; unreadReports: number; newUsers: number; newQuestions: number; engagement: number } };
type Report = { id: string; reason: string; status: string; questionId: string | null; answerId: string | null; commentId: string | null; createdAt: string; reporter: { name: string; username: string } };
type ManagedUser = { id: string; name: string; email: string; username: string; role: string; isSuspended: boolean; createdAt: string; _count: { questions: number; answers: number } };

export function AdminClient({ user }: { user: Viewer }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (search = "") => {
    setLoading(true); setMessage("");
    try {
      const [nextAnalytics, nextReports, nextUsers] = await Promise.all([api<Analytics>("/api/admin/analytics"), api<Report[]>("/api/admin/reports?take=30"), api<ManagedUser[]>(`/api/admin/users?take=30${search ? `&q=${encodeURIComponent(search)}` : ""}`)]);
      setAnalytics(nextAnalytics); setReports(nextReports); setUsers(nextUsers);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load moderation data."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function setReportStatus(id: string, status: string) {
    try { await api(`/api/admin/reports?id=${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); setReports((items) => items.map((report) => report.id === id ? { ...report, status } : report)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update report."); }
  }
  async function suspend(target: ManagedUser) {
    try { await api(`/api/admin/users/${target.id}`, { method: "PATCH", body: JSON.stringify({ isSuspended: !target.isSuspended }) }); setUsers((items) => items.map((item) => item.id === target.id ? { ...item, isSuspended: !item.isSuspended } : item)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update account."); }
  }
  const metrics = analytics?.metrics;
  return <main className="platform-page admin-page"><div className="utility-heading"><div><p className="section-kicker"><ShieldCheck size={14} /> Moderation</p><h1>Campus admin</h1><p>Review community health and manage reported content.</p></div></div>{message && <p className="inline-error">{message}</p>}{loading && !metrics ? <p className="page-message">Loading moderation workspace…</p> : <><section className="admin-metrics">{[["Members", metrics?.users ?? 0], ["Questions", metrics?.questions ?? 0], ["Answers", metrics?.answers ?? 0], ["Open reports", metrics?.unreadReports ?? 0], ["7-day members", metrics?.newUsers ?? 0], ["Engagement", metrics?.engagement ?? 0]].map(([label, value]) => <div key={String(label)}><small>{label}</small><b>{value}</b></div>)}</section><section className="admin-section"><div className="section-title"><h2>Reports</h2><span>{reports.length} recent</span></div>{reports.length ? <div className="admin-table">{reports.map((report) => <div className="admin-row" key={report.id}><span><b>{report.reporter.name}</b><small>@{report.reporter.username} · {new Date(report.createdAt).toLocaleDateString()}</small></span><p>{report.reason}</p><small>{report.questionId ? "Question" : report.answerId ? "Answer" : "Comment"}</small><select value={report.status} onChange={(event) => setReportStatus(report.id, event.target.value)}><option value="OPEN">Open</option><option value="REVIEWING">Reviewing</option><option value="RESOLVED">Resolved</option><option value="DISMISSED">Dismissed</option></select></div>)}</div> : <div className="empty-state"><h2>No reports to review.</h2><p>Your campus feed is clear for now.</p></div>}</section><section className="admin-section"><div className="section-title"><h2>Member accounts</h2><form className="admin-search" onSubmit={(event) => { event.preventDefault(); load(query); }}><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members" /><button>Search</button></form></div><div className="admin-table">{users.map((member) => <div className="admin-row admin-user-row" key={member.id}><span><b>{member.name}</b><small>@{member.username} · {member.email}</small></span><small>{member.role}</small><small>{member._count.questions} questions · {member._count.answers} answers</small><button disabled={member.id === user?.id} className={member.isSuspended ? "admin-restore" : "admin-suspend"} onClick={() => suspend(member)}>{member.isSuspended ? "Restore" : "Suspend"}</button></div>)}</div></section></>}</main>;
}
