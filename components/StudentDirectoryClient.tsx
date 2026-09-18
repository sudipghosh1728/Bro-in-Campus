"use client";

import Link from "next/link";
import { GraduationCap, Search, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import type { Viewer } from "@/lib/types";
import { Avatar } from "./Avatar";

type College = { id: string; name: string; slug: string; city: string; coverColor: string; verified: boolean; memberCount: number };
type Student = { id: string; name: string; username: string; avatarUrl: string | null; bio: string | null; course: string | null; campus: string | null; role: string; followerCount: number; questionCount: number; following: boolean; college: College };
type StudentData = { students: Student[] };
type CampusGroup = College & { students: Student[] };

function groupByCampus(students: Student[]) {
  const groups = new Map<string, CampusGroup>();
  for (const student of students) {
    const existing = groups.get(student.college.id);
    if (existing) existing.students.push(student);
    else groups.set(student.college.id, { ...student.college, students: [student] });
  }
  return [...groups.values()];
}

export function StudentDirectoryClient({ initialData, user, initialQuery }: { initialData: StudentData; user: Viewer; initialQuery: string }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const campuses = useMemo(() => groupByCampus(data.students), [data.students]);

  async function load(nextQuery = query, updateUrl = false) {
    setLoading(true); setMessage("");
    try {
      const next = await api<StudentData>(`/api/students?q=${encodeURIComponent(nextQuery)}`);
      setData(next);
      if (updateUrl) router.replace(nextQuery ? `/students?q=${encodeURIComponent(nextQuery)}` : "/students", { scroll: false });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not search campus communities."); }
    finally { setLoading(false); }
  }

  function search(event: FormEvent) { event.preventDefault(); void load(query, true); }

  useEffect(() => {
    const stream = new EventSource("/api/realtime");
    const refreshMemberships = () => { void load(query); };
    stream.addEventListener("COLLEGE_MEMBERSHIP_CHANGED", refreshMemberships);
    return () => stream.close();
  // Membership changes are the only background event for this directory.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function follow(student: Student) {
    if (!user) return router.push("/login?next=/students");
    if (student.id === user.id) return;
    const following = !student.following;
    setData((current) => ({ students: current.students.map((item) => item.id === student.id ? { ...item, following, followerCount: item.followerCount + (following ? 1 : -1) } : item) }));
    try { await api(`/api/users/${student.id}/follow`, { method: following ? "POST" : "DELETE" }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update follow."); setData(initialData); }
  }

  return <main className="app-page students-page">
    <section className="students-hero"><div><p className="section-kicker"><GraduationCap size={15} /> People directory</p><h1>Find the people<br /><em>who get it.</em></h1><p>Residents are grouped by their college, hostel, campus or society—so every shared home appears once and its member count stays current.</p></div><div><UsersRound size={21} /><b>{campuses.length}</b><span>{campuses.length === 1 ? "campus community" : "campus communities"}</span></div></section>
    <section className="student-directory-toolbar"><form className="search-bar" onSubmit={search}><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people by name or username" /><button className="button button--dark" disabled={loading}>{loading ? "Searching…" : "Search"}</button></form><Link href="/colleges" className="directory-link">Browse campuses</Link></section>
    {message && <p className="inline-error page-message">{message}</p>}
    <section className="students-directory"><div className="list-heading"><div><p className="section-kicker">Across the network</p><h2>{query ? `Campus communities matching “${query}”` : "Campus communities building better everyday life"}</h2></div><span>{campuses.length} {campuses.length === 1 ? "campus" : "campuses"} shown</span></div>{campuses.length ? <div className="student-directory-grid">{campuses.map((campus) => <article className="student-directory-card student-directory-card--campus" key={campus.id}><div className="student-directory-card__top"><span className={`mini-college-mark mini-college-mark--${campus.coverColor}`}>{campus.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span><span className="campus-member-count"><UsersRound size={13} /> {campus.memberCount} {campus.memberCount === 1 ? "resident" : "residents"}</span></div><Link href={`/colleges/${campus.slug}`}><h3>{campus.name}</h3><p>{campus.city}</p></Link><small className="student-college"><GraduationCap size={13} /><Link href={`/colleges/${campus.slug}`}>Open campus community</Link></small><div className="campus-resident-list">{campus.students.slice(0, 4).map((student) => <div className="campus-resident" key={student.id}><Link href={`/u/${student.username}`} className="campus-resident__identity"><Avatar name={student.name} src={student.avatarUrl} size="sm" /><span><b>{student.name}</b><small>{student.course || student.role.toLowerCase()}</small></span></Link>{user?.id !== student.id && <button className={student.following ? "student-follow following" : "student-follow"} onClick={() => follow(student)}>{student.following ? "Following" : "Follow"}</button>}</div>)}</div><footer><span>{campus.memberCount} {campus.memberCount === 1 ? "member" : "members"} in this community</span><Link href={`/colleges/${campus.slug}`}>View campus</Link></footer></article>)}</div> : <div className="empty-state"><h2>No campus communities found.</h2><p>Try another search, or join your campus to make it visible in the people directory.</p><Link className="button button--red" href="/colleges">Find your campus</Link></div>}</section>
  </main>;
}
