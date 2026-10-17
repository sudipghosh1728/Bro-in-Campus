"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, BrainCircuit, ChevronRight, Landmark, Mail, Newspaper, Sparkles, Trophy } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { api } from "@/lib/client-api";

type Department = { id: string; name: string; slug: string; synopsis: string; focusAreas: string[]; accent: string; demandSignal: number };
type LearningPath = { id: string; title: string; slug: string; departmentSlug: string; level: string; duration: string; description: string; skills: string[]; milestones: { title: string; outcome: string }[]; trendScore: number; featured: boolean; fitScore: number };
type Scholarship = { id: string; title: string; slug: string; provider: string; description: string; amount: string | null; eligibility: string; categories: string[]; applicationUrl: string | null; deadline: string | null; featured: boolean };
type Briefing = { id: string; title: string; slug: string; summary: string; category: string; sourceName: string; sourceUrl: string | null; publishedAt: string; featured: boolean };
type GrowthData = { recommendationLabel: string; departments: Department[]; paths: LearningPath[]; scholarships: Scholarship[]; briefings: Briefing[] };

const interests = ["EDUCATION", "ECONOMY", "ENGINEERING", "TECHNOLOGY", "CAREERS", "SCHOLARSHIPS"] as const;
const display = (value: string) => value.split("_").map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");

export function GrowthHubClient({ initialData, initialEmail }: { initialData: GrowthData; initialEmail: string }) {
  const [department, setDepartment] = useState("all");
  const [email, setEmail] = useState(initialEmail);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["EDUCATION", "TECHNOLOGY", "CAREERS"]);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const paths = useMemo(() => department === "all" ? initialData.paths : initialData.paths.filter((path) => path.departmentSlug === department), [department, initialData.paths]);

  function toggleInterest(value: string) {
    setSelectedInterests((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function subscribe(event: FormEvent) {
    event.preventDefault();
    setSending(true); setNotice("");
    try {
      await api("/api/newsletter", { method: "POST", body: JSON.stringify({ email, interests: selectedInterests }) });
      setNotice("You’re on the briefing list. We’ll keep it focused and useful.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save your briefing preferences.");
    } finally { setSending(false); }
  }

  return <main className="app-page growth-page">
    <section className="growth-hero">
      <div className="growth-hero__copy"><p className="section-kicker"><Sparkles size={15} /> Student growth system</p><h1>A sharper next<br /><em>semester starts here.</em></h1><p>Pick a direction, see the skills moving fastest, and turn scattered resources into a practical learning plan built around your department.</p><div className="growth-hero__actions"><a className="button button--red" href="#roadmaps">Find my roadmap <ChevronRight size={17} /></a><a className="text-link growth-text-link" href="#briefing">Today’s briefing</a></div></div>
      <div className="growth-orbit" aria-label="A visual map of student growth"><span className="growth-orbit__core"><BrainCircuit size={37} /><b>Next<br />move</b></span><i className="growth-orbit__ring growth-orbit__ring--one" /><i className="growth-orbit__ring growth-orbit__ring--two" /><small className="growth-orbit__tag growth-orbit__tag--one">Build</small><small className="growth-orbit__tag growth-orbit__tag--two">Explore</small><small className="growth-orbit__tag growth-orbit__tag--three">Apply</small></div>
    </section>

    <section className="growth-departments" aria-labelledby="departments-heading"><div className="list-heading"><div><p className="section-kicker"><BookOpenCheck size={14} /> Every direction has a start</p><h2 id="departments-heading">Choose your department lens</h2></div><span>{initialData.departments.length} learning constellations</span></div><div className="department-strip"><button className={department === "all" ? "department-pill active" : "department-pill"} onClick={() => setDepartment("all")}>All pathways</button>{initialData.departments.map((item) => <button key={item.id} className={department === item.slug ? `department-pill active department-pill--${item.accent}` : `department-pill department-pill--${item.accent}`} onClick={() => setDepartment(item.slug)}><b>{item.name}</b><small>{item.focusAreas.slice(0, 2).join(" · ")}</small></button>)}</div></section>

    <section className="roadmap-section" id="roadmaps"><div className="roadmap-section__heading"><div><p className="section-kicker"><BrainCircuit size={14} /> {initialData.recommendationLabel}</p><h2>Roadmaps with a real finish line</h2></div><p>Start small. Build proof. Keep a record of what you can do—not only what you watched.</p></div><div className="roadmap-grid">{paths.slice(0, 6).map((path, index) => <article className="roadmap-card" key={path.id}><div className="roadmap-card__top"><span>{String(index + 1).padStart(2, "0")}</span><small>{display(path.level)} · {path.duration}</small>{path.fitScore > 0 && <b>For you</b>}</div><h3>{path.title}</h3><p>{path.description}</p><div className="roadmap-skill-list">{path.skills.slice(0, 4).map((skill) => <i key={skill}>{skill}</i>)}</div><ol>{path.milestones.slice(0, 3).map((milestone) => <li key={milestone.title}><b>{milestone.title}</b><span>{milestone.outcome}</span></li>)}</ol></article>)}</div>{!paths.length && <div className="empty-state compact-empty"><h2>No pathway in this lane yet.</h2><p>Choose another department to explore its current learning routes.</p></div>}</section>

    <section className="growth-split"><section className="scholarship-panel" id="scholarships"><div className="list-heading"><div><p className="section-kicker"><Trophy size={14} /> Funding finder</p><h2>Scholarships worth tracking</h2></div><Link href="/colleges">Campus support <ArrowUpRight size={14} /></Link></div><p className="section-intro">Review eligibility and official deadlines before applying. Listings link to the provider whenever an application page is available.</p><div className="scholarship-list">{initialData.scholarships.slice(0, 5).map((item) => <article className="scholarship-row" key={item.id}><div><span>{item.provider}</span><h3>{item.title}</h3><p>{item.eligibility}</p><div>{item.categories.map((category) => <i key={category}>{display(category)}</i>)}</div></div><aside>{item.amount && <b>{item.amount}</b>}{item.deadline && <small>Due {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(item.deadline))}</small>}{item.applicationUrl && <a href={item.applicationUrl} target="_blank" rel="noreferrer">Official page <ArrowUpRight size={13} /></a>}</aside></article>)}</div></section>
      <section className="briefing-panel" id="briefing"><div className="list-heading"><div><p className="section-kicker"><Newspaper size={14} /> The student briefing</p><h2>Signals to know</h2></div></div><div className="briefing-list">{initialData.briefings.slice(0, 4).map((item) => <article key={item.id}><span>{display(item.category)} · {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(item.publishedAt))}</span><h3>{item.title}</h3><p>{item.summary}</p>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceName} <ArrowUpRight size={12} /></a> : <small>{item.sourceName}</small>}</article>)}</div></section></section>

    <section className="newsletter-panel"><div><p className="section-kicker"><Mail size={14} /> No noise, just useful signals</p><h2>Build a better inbox for your future.</h2><p>Choose what you care about. The briefing is designed around education, the economy, emerging technology, careers and funding opportunities.</p></div><form onSubmit={subscribe}><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label><div className="newsletter-interest-row">{interests.map((interest) => <button type="button" key={interest} className={selectedInterests.includes(interest) ? "selected" : ""} onClick={() => toggleInterest(interest)}>{display(interest)}</button>)}</div><button className="button button--dark" disabled={sending}>{sending ? "Saving…" : "Get the briefing"}</button>{notice && <p className={notice.includes("Could") || notice.includes("valid") ? "inline-error" : "inline-success"}>{notice}</p>}</form></section>
  </main>;
}
