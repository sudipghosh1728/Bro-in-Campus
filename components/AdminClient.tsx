"use client";

import { Search, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminColleges, type ManagedCollege } from "@/components/AdminColleges";
import { api } from "@/lib/client-api";
import type { Viewer } from "@/lib/types";

type Analytics = { metrics: { users: number; questions: number; answers: number; comments: number; unreadReports: number; newUsers: number; engagement: number } };
type Report = { id: string; reason: string; status: string; questionId: string | null; answerId: string | null; commentId: string | null; createdAt: string; reporter: { name: string; username: string } };
type ManagedUser = { id: string; name: string; email: string; username: string; role: "USER" | "MODERATOR" | "ADMIN"; isSuspended: boolean; createdAt: string; _count: { questions: number; answers: number } };
type ImpersonationAudit = { id: string; adminEmail: string; targetEmail: string; ipAddress: string | null; startedAt: string; endedAt: string | null };
type Dashboard = { analytics: Analytics; reports: Report[]; users: ManagedUser[]; impersonations: ImpersonationAudit[]; colleges: ManagedCollege[] };

export function AdminClient({ user }: { user: Viewer }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [impersonations, setImpersonations] = useState<ImpersonationAudit[]>([]);
  const [colleges, setColleges] = useState<ManagedCollege[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [purging, setPurging] = useState(false);
  const searchRequest = useRef<AbortController | null>(null);

  async function searchMembers() {
    searchRequest.current?.abort();
    const controller = new AbortController();
    searchRequest.current = controller;
    setLoading(true); setMessage("");
    try {
      const result = await api<ManagedUser[]>(`/api/admin/users?take=30&q=${encodeURIComponent(query)}`, { signal: controller.signal });
      if (!controller.signal.aborted) setUsers(result);
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Could not search members.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }

  useEffect(() => () => searchRequest.current?.abort(), []);

  const load = useCallback(async (search = "") => {
    setLoading(true);
    setMessage("");
    try {
      const dashboard = await api<Dashboard>(`/api/admin/dashboard?take=30${search ? `&q=${encodeURIComponent(search)}` : ""}`);
      setAnalytics(dashboard.analytics);
      setReports(dashboard.reports);
      setUsers(dashboard.users);
      setImpersonations(dashboard.impersonations);
      setColleges(dashboard.colleges);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load moderation data.");
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => { load(); }, [load]);

  async function setReportStatus(id: string, status: string) {
    try {
      await api(`/api/admin/reports?id=${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setReports((items) => items.map((report) => report.id === id ? { ...report, status } : report));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update report.");
    }
  }

  async function suspend(target: ManagedUser) {
    try {
      const updated = await api<{ isSuspended: boolean }>(`/api/admin/users/${target.id}`, { method: "PATCH", body: JSON.stringify({ isSuspended: !target.isSuspended }) });
      setUsers((items) => items.map((item) => item.id === target.id ? { ...item, isSuspended: updated.isSuspended } : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update account.");
    }
  }

  async function setRole(target: ManagedUser, role: ManagedUser["role"]) {
    try {
      const updated = await api<{ role: ManagedUser["role"] }>(`/api/admin/users/${target.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      setUsers((items) => items.map((item) => item.id === target.id ? { ...item, role: updated.role } : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update account role.");
    }
  }

  async function impersonate(target: ManagedUser) {
    if (!window.confirm(`Start a tracked support session as ${target.name}? You can stop impersonating from the banner at the top of the app.`)) return;
    try {
      await api(`/api/admin/users/${target.id}/impersonate`, { method: "POST" });
      window.location.assign("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start impersonation.");
    }
  }

  async function deleteUser(target: ManagedUser) {
    if (!window.confirm(`Permanently delete ${target.name}, their posts, account data, and sessions? Admin accounts cannot be deleted here.`)) return;
    try {
      await api(`/api/admin/users/${target.id}`, { method: "DELETE" });
      setUsers((items) => items.filter((item) => item.id !== target.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete account.");
    }
  }

  async function purgeUsers() {
    if (purgeConfirmation !== "DELETE NON-ADMIN USERS") return;
    if (!window.confirm("Permanently delete all non-admin accounts and their user data from this deployment's database? Admin accounts will be kept. This cannot be undone.")) return;
    setPurging(true);
    setMessage("");
    try {
      await api("/api/admin/users/purge", { method: "POST", body: JSON.stringify({ confirmation: purgeConfirmation }) });
      window.location.assign("/admin");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not clear user data.");
      setPurging(false);
    }
  }

  const metrics = analytics?.metrics;
  return <main className="platform-page admin-page">
    <div className="utility-heading"><div><p className="section-kicker"><ShieldCheck size={14} /> Moderation</p><h1>Campus admin</h1><p>Review community health and manage reported content.</p></div></div>
    {message && <p className="inline-error">{message}</p>}
    {loading && !metrics ? <p className="page-message">Loading moderation workspace…</p> : <>
      <section className="admin-metrics">{[["Members", metrics?.users ?? 0], ["Questions", metrics?.questions ?? 0], ["Answers", metrics?.answers ?? 0], ["Open reports", metrics?.unreadReports ?? 0], ["7-day members", metrics?.newUsers ?? 0], ["Engagement", metrics?.engagement ?? 0]].map(([label, value]) => <div key={String(label)}><small>{label}</small><b>{value}</b></div>)}</section>
      <section className="admin-section">
        <div className="section-title"><h2>Reports</h2><span>{reports.length} recent</span></div>
        {reports.length ? <div className="admin-table">{reports.map((report) => <div className="admin-row" key={report.id}>
          <span><b>{report.reporter.name}</b><small>@{report.reporter.username} · {new Date(report.createdAt).toLocaleDateString()}</small></span>
          <p>{report.reason}</p><small>{report.questionId ? "Question" : report.answerId ? "Answer" : "Comment"}</small>
          <select value={report.status} onChange={(event) => setReportStatus(report.id, event.target.value)}><option value="OPEN">Open</option><option value="REVIEWING">Reviewing</option><option value="RESOLVED">Resolved</option><option value="DISMISSED">Dismissed</option></select>
        </div>)}</div> : <div className="empty-state"><h2>No reports to review.</h2><p>Your campus feed is clear for now.</p></div>}
      </section>
      <section className="admin-section">
        <div className="section-title"><h2>Member accounts</h2><form className="admin-search" onSubmit={(event) => { event.preventDefault(); searchMembers(); }}><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members" /><button>Search</button></form></div>
        <div className="admin-table">{users.map((member) => <div className="admin-row admin-user-row" key={member.id}>
          <span><b>{member.name}</b><small>@{member.username} · {member.email}</small></span>
          {user?.role === "ADMIN" ? <select aria-label={`Role for ${member.username}`} value={member.role} disabled={member.id === user.id || member.role === "ADMIN"} onChange={(event) => {
            const role = event.target.value;
            if (role === "USER" || role === "MODERATOR" || role === "ADMIN") void setRole(member, role);
          }}><option value="USER">User</option><option value="MODERATOR">Moderator</option><option value="ADMIN">Admin</option></select> : <small>{member.role}</small>}
          <small>{member._count.questions} questions · {member._count.answers} answers</small>
          <div className="admin-user-actions">
            <button disabled={member.id === user?.id || (member.role === "ADMIN" && !member.isSuspended)} className={member.isSuspended ? "admin-restore" : "admin-suspend"} onClick={() => suspend(member)}>{member.isSuspended ? "Restore" : "Suspend"}</button>
            {user?.role === "ADMIN" && member.role === "USER" && <button disabled={member.id === user.id || member.isSuspended} onClick={() => impersonate(member)}>View as user</button>}
            {user?.role === "ADMIN" && member.role !== "ADMIN" && <button className="admin-suspend" disabled={member.id === user.id} onClick={() => deleteUser(member)}>Delete</button>}
          </div>
        </div>)}</div>
      </section>
      {user?.role === "ADMIN" && <AdminColleges initialColleges={colleges} />}
      {user?.role === "ADMIN" && <section className="admin-section"><div className="section-title"><h2>Support access log</h2><span>{impersonations.length} recent</span></div>{impersonations.length ? <div className="admin-table">{impersonations.map((record) => <div className="admin-row admin-audit-row" key={record.id}><span><b>{record.adminEmail}</b><small>as {record.targetEmail}</small></span><small>{new Date(record.startedAt).toLocaleString()}</small><small>{record.endedAt ? `Ended ${new Date(record.endedAt).toLocaleString()}` : "Not explicitly ended"}</small><small>{record.ipAddress ?? "IP unavailable"}</small></div>)}</div> : <p className="empty-state">No support sessions have been recorded.</p>}</section>}
      {user?.role === "ADMIN" && <section className="admin-section admin-danger-zone"><div>
        <p className="section-kicker"><Trash2 size={14} /> Danger zone</p><h2>Clear non-admin accounts</h2>
        <p>This deletes non-admin accounts and their authored content and account-linked data in this deployment’s configured database. All admin accounts and their sessions remain. Shared catalogs are kept. This cannot be undone.</p>
        <label htmlFor="purge-confirmation">Type <b>DELETE NON-ADMIN USERS</b> to enable deletion.</label>
        <input id="purge-confirmation" value={purgeConfirmation} onChange={(event) => setPurgeConfirmation(event.target.value)} autoComplete="off" spellCheck={false} disabled={purging} />
        <button className="admin-purge-button" disabled={purgeConfirmation !== "DELETE NON-ADMIN USERS" || purging} onClick={purgeUsers}>{purging ? "Deleting user data…" : "Delete non-admin users and user data"}</button>
      </div></section>}
    </>}
  </main>;
}
