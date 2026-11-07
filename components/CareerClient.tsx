"use client";

import Link from "next/link";
import { Bookmark, BriefcaseBusiness, Building2, ExternalLink, MapPin, Plus, Search, Star } from "lucide-react";
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
  const [showPost, setShowPost] = useState(false);
  const [posting, setPosting] = useState(false);
  const [opportunity, setOpportunity] = useState({ companyName: "", companyIndustry: "", companyLocation: "", companyWebsite: "", title: "", location: "", employmentType: "INTERNSHIP", stipend: "", description: "", skills: "", applicationUrl: "", deadline: "" });
  const canPost = Boolean(user && (user.role !== "USER" || user.profession === "HR"));

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

  async function publishOpportunity(event: FormEvent) {
    event.preventDefault();
    setPosting(true); setNotice("");
    try {
      await api("/api/careers", { method: "POST", body: JSON.stringify({ ...opportunity, skills: opportunity.skills.split(",").map((skill) => skill.trim()).filter(Boolean), deadline: opportunity.deadline ? new Date(opportunity.deadline).toISOString() : null }) });
      await load(); setShowPost(false); setOpportunity({ companyName: "", companyIndustry: "", companyLocation: "", companyWebsite: "", title: "", location: "", employmentType: "INTERNSHIP", stipend: "", description: "", skills: "", applicationUrl: "", deadline: "" }); setNotice("Opportunity published to the student career board.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not publish this opportunity."); }
    finally { setPosting(false); }
  }

  return <main className="app-page careers-page">
    <section className="page-hero page-hero--career">
      <div><p className="section-kicker"><BriefcaseBusiness size={15} /> Career intelligence, for students</p><h1>Make your next<br /><em>move informed.</em></h1><p>Explore honest campus-to-career reviews, find openings, and build a shortlist worth applying to.</p>{canPost && <button className="button button--dark career-post-button" onClick={() => setShowPost(true)}><Plus size={16} /> Post an opportunity</button>}</div>
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
    {showPost && <div className="modal-backdrop" onMouseDown={() => setShowPost(false)}><form className="request-modal opportunity-modal" onSubmit={publishOpportunity} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowPost(false)}>×</button><p className="section-kicker"><BriefcaseBusiness size={14} /> Employer listing</p><h2>Reach the right students.</h2><p>Publish a clear, student-friendly role. Use an official application link and share only practical requirements.</p><div className="form-two"><label>Company name<input value={opportunity.companyName} onChange={(event) => setOpportunity({ ...opportunity, companyName: event.target.value })} required minLength={2} maxLength={120} /></label><label>Industry<input value={opportunity.companyIndustry} onChange={(event) => setOpportunity({ ...opportunity, companyIndustry: event.target.value })} required minLength={2} maxLength={120} placeholder="e.g. Climate technology" /></label></div><div className="form-two"><label>Company location<input value={opportunity.companyLocation} onChange={(event) => setOpportunity({ ...opportunity, companyLocation: event.target.value })} required minLength={2} maxLength={120} /></label><label>Company website <small>(optional)</small><input type="url" value={opportunity.companyWebsite} onChange={(event) => setOpportunity({ ...opportunity, companyWebsite: event.target.value })} maxLength={300} placeholder="https://" /></label></div><label>Role title<input value={opportunity.title} onChange={(event) => setOpportunity({ ...opportunity, title: event.target.value })} required minLength={4} maxLength={180} placeholder="e.g. Data analyst intern" /></label><div className="form-two"><label>Type<select value={opportunity.employmentType} onChange={(event) => setOpportunity({ ...opportunity, employmentType: event.target.value })}>{["INTERNSHIP", "FULL_TIME", "PART_TIME", "APPRENTICESHIP"].map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}</select></label><label>Role location<input value={opportunity.location} onChange={(event) => setOpportunity({ ...opportunity, location: event.target.value })} required minLength={2} maxLength={160} placeholder="Remote / city" /></label></div><div className="form-two"><label>Stipend / package <small>(optional)</small><input value={opportunity.stipend} onChange={(event) => setOpportunity({ ...opportunity, stipend: event.target.value })} maxLength={120} placeholder="e.g. ₹30k/month" /></label><label>Apply by <small>(optional)</small><input type="date" value={opportunity.deadline} onChange={(event) => setOpportunity({ ...opportunity, deadline: event.target.value })} /></label></div><label>Skills <small>Comma-separated</small><input value={opportunity.skills} onChange={(event) => setOpportunity({ ...opportunity, skills: event.target.value })} required placeholder="SQL, Python, communication" /></label><label>Official application URL <small>(optional)</small><input type="url" value={opportunity.applicationUrl} onChange={(event) => setOpportunity({ ...opportunity, applicationUrl: event.target.value })} maxLength={300} placeholder="https://" /></label><label>Role summary<textarea value={opportunity.description} onChange={(event) => setOpportunity({ ...opportunity, description: event.target.value })} required minLength={30} maxLength={5000} placeholder="What will the student learn, build and need to know?" /></label>{notice && <p className="inline-error" role="alert">{notice}</p>}<button className="button button--dark" disabled={posting}>{posting ? "Publishing…" : "Publish opportunity"}</button></form></div>}
  </main>;
}
