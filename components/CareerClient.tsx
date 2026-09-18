"use client";

import Link from "next/link";
import { Bookmark, BriefcaseBusiness, Building2, ExternalLink, MapPin, Search, Star } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import type { Viewer } from "@/lib/types";

type Company = { id: string; name: string; slug: string; industry: string; location: string; logoColor: string; rating: number | null; reviewCount: number; jobCount: number };
type Opportunity = { id: string; title: string; location: string; employmentType: string; stipend: string | null; description: string; skills: string[]; applicationUrl: string | null; deadline: string | null; createdAt?: string; saved: boolean; company: { name: string; slug: string; logoColor: string } | null };
type CareerData = { companies: Company[]; opportunities: Opportunity[] };

function typeLabel(type: string) { return type === "FULL_TIME" ? "Full time" : type === "PART_TIME" ? "Part time" : type === "APPRENTICESHIP" ? "Apprenticeship" : "Internship"; }

export function CareerClient({ initialData, user }: { initialData: CareerData; user: Viewer }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function load(nextQuery = query, nextType = type) {
    setLoading(true); setNotice("");
    try {
      const params = new URLSearchParams();
      if (nextQuery) params.set("q", nextQuery);
      if (nextType) params.set("type", nextType);
      setData(await api<CareerData>(`/api/careers?${params}`));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update opportunities."); }
    finally { setLoading(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); load(); }
  async function save(job: Opportunity) {
    if (!user) return router.push("/login?next=/careers");
    const saved = !job.saved;
    setData((current) => ({ ...current, opportunities: current.opportunities.map((item) => item.id === job.id ? { ...item, saved } : item) }));
    try { await api(`/api/careers/opportunities/${job.id}/save`, { method: saved ? "POST" : "DELETE" }); }
    catch { setData((current) => ({ ...current, opportunities: current.opportunities.map((item) => item.id === job.id ? { ...item, saved: !saved } : item) })); setNotice("Could not update saved opportunities."); }
  }

  return <main className="app-page careers-page">
    <section className="page-hero page-hero--career">
      <div><p className="section-kicker"><BriefcaseBusiness size={15} /> Career intelligence, for students</p><h1>Make your next<br /><em>move informed.</em></h1><p>Explore honest campus-to-career reviews, find openings, and build a shortlist worth applying to.</p></div>
      <div className="hero-metrics"><span><b>{data.companies.length || "—"}</b> companies</span><span><b>{data.opportunities.length || "—"}</b> live roles</span><span><b>100%</b> student-led</span></div>
    </section>
    <section className="career-controls">
      <form className="search-bar" onSubmit={submit}><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search companies, roles, or locations" /><button className="button button--dark" type="submit">Search</button></form>
      <div className="filter-row"><span>Show:</span>{[["", "All opportunities"], ["INTERNSHIP", "Internships"], ["FULL_TIME", "Full time"], ["PART_TIME", "Part time"]].map(([value, label]) => <button key={value} className={type === value ? "selected" : ""} onClick={() => { setType(value); load(query, value); }}>{label}</button>)}<small>{loading ? "Updating…" : `${data.opportunities.length} results`}</small></div>
    </section>
    {notice && <p className="inline-error page-error">{notice}</p>}
    <section className="career-layout">
      <div className="opportunity-list"><div className="list-heading"><div><p className="section-kicker">Open on campus</p><h2>Opportunities to act on</h2></div></div>{data.opportunities.length ? data.opportunities.map((job) => <article className="opportunity-card" key={job.id}><div className={`company-mark company-mark--${job.company?.logoColor ?? "slate"}`}>{job.company?.name.slice(0, 2).toUpperCase() ?? "BI"}</div><div className="opportunity-card__copy"><span>{job.company ? <Link href={`/careers/${job.company.slug}`}>{job.company.name}</Link> : "Campus partner"} · {typeLabel(job.employmentType)}</span><h3>{job.title}</h3><p><MapPin size={14} /> {job.location}{job.stipend && <> <i>·</i> {job.stipend}</>}</p><div className="skill-pills">{job.skills.slice(0, 4).map((skill) => <b key={skill}>{skill}</b>)}</div></div><div className="opportunity-card__actions"><button className={job.saved ? "save-button saved" : "save-button"} onClick={() => save(job)} aria-label="Save opportunity"><Bookmark size={18} fill={job.saved ? "currentColor" : "none"} /></button>{job.applicationUrl ? <a className="apply-link" href={job.applicationUrl} target="_blank" rel="noreferrer">Apply <ExternalLink size={14} /></a> : <span className="apply-unavailable">Application unavailable</span>}</div></article>) : <div className="empty-state"><h2>No roles matched that search.</h2><p>Try a broader role, company or location.</p></div>}</div>
      <aside className="company-sidebar"><div className="list-heading"><p className="section-kicker">Research before you apply</p><h2>Company pulse</h2></div>{data.companies.length ? data.companies.slice(0, 6).map((company) => <Link className="company-row" href={`/careers/${company.slug}`} key={company.id}><div className={`company-mark company-mark--${company.logoColor}`}>{company.name.slice(0, 2).toUpperCase()}</div><div><b>{company.name}</b><small>{company.industry} · {company.location}</small><span>{company.rating ? <><Star size={13} fill="currentColor" /> {company.rating}</> : "No reviews yet"} <i>·</i> {company.reviewCount} reviews</span></div><strong>{company.jobCount} roles</strong></Link>) : <div className="side-empty">Companies will appear as your placement cell and students add them.</div>}</aside>
    </section>
  </main>;
}
