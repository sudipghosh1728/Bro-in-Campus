"use client";

import Link from "next/link";
import { Bookmark, ExternalLink, MapPin, Star } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import type { Viewer } from "@/lib/types";

type Job = { id: string; title: string; location: string; employmentType: string; stipend: string | null; description: string; skills: string[]; applicationUrl: string | null; deadline: string | null; saved: boolean };
type Review = { id: string; rating: number; title: string; pros: string; cons: string | null; role: string | null; isAnonymous: boolean; author: { name: string; username: string } | null; createdAt: string };
type CompanyProfile = { id: string; name: string; slug: string; industry: string; location: string; website: string | null; description: string; logoColor: string; rating: number | null; reviews: Review[]; jobs: Job[] };

function stars(rating: number) { return Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} fill={index < rating ? "currentColor" : "none"} />); }

export function CompanyProfileClient({ company, user }: { company: CompanyProfile; user: Viewer }) {
  const router = useRouter();
  const [reviews, setReviews] = useState(company.reviews);
  const [jobs, setJobs] = useState(company.jobs);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ rating: 5, title: "", pros: "", cons: "", role: "", isAnonymous: false });
  const [sending, setSending] = useState(false);

  async function save(job: Job) {
    if (!user) return router.push(`/login?next=/careers/${company.slug}`);
    const saved = !job.saved; setJobs((current) => current.map((item) => item.id === job.id ? { ...item, saved } : item));
    try { await api(`/api/careers/opportunities/${job.id}/save`, { method: saved ? "POST" : "DELETE" }); }
    catch { setJobs((current) => current.map((item) => item.id === job.id ? { ...item, saved: !saved } : item)); setNotice("Could not update saved opportunities."); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return router.push(`/login?next=/careers/${company.slug}`);
    setSending(true); setNotice("");
    try { await api(`/api/careers/companies/${company.id}/reviews`, { method: "POST", body: JSON.stringify(form) }); setShowForm(false); setForm({ rating: 5, title: "", pros: "", cons: "", role: "", isAnonymous: false }); setNotice("Thanks—your review is now part of the campus intelligence."); router.refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not publish your review."); }
    finally { setSending(false); }
  }
  return <main className="app-page company-page"><Link className="back-link" href="/careers">← Back to careers</Link><section className="company-hero"><div className={`company-mark company-mark--${company.logoColor}`}>{company.name.slice(0, 2).toUpperCase()}</div><div><p className="section-kicker">{company.industry}</p><h1>{company.name}</h1><p><MapPin size={16} /> {company.location} {company.website && <><i>·</i> <a href={company.website} target="_blank" rel="noreferrer">Website <ExternalLink size={13} /></a></>}</p></div><div className="company-score"><b>{company.rating ?? "—"}</b><span>{company.rating ? stars(Math.round(company.rating)) : "Awaiting reviews"}</span><small>{reviews.length} student reviews</small></div></section><p className="company-description">{company.description}</p>{notice && <p className="inline-success page-message">{notice}</p>}<section className="company-layout"><div><section className="profile-section"><div className="list-heading"><div><p className="section-kicker">The real picture</p><h2>What students say</h2></div><button className="button button--dark" onClick={() => setShowForm(true)}>Write a review</button></div>{reviews.length ? <div className="review-list">{reviews.map((review) => <article className="review-card" key={review.id}><div><span className="review-stars">{stars(review.rating)}</span><time>{new Date(review.createdAt).toLocaleDateString()}</time></div><h3>{review.title}</h3>{review.role && <p className="review-role">{review.role}</p>}<p><b>Best part:</b> {review.pros}</p>{review.cons && <p><b>Keep in mind:</b> {review.cons}</p>}<small>{review.author ? `${review.author.name} · @${review.author.username}` : "Anonymous student review"}</small></article>)}</div> : <div className="empty-state"><h2>Be the first to share the real experience.</h2><p>Your thoughtful review can help a fellow student choose with confidence.</p></div>}</section></div><aside className="jobs-panel"><div className="list-heading"><div><p className="section-kicker">Open roles</p><h2>Apply from campus</h2></div></div>{jobs.length ? jobs.map((job) => <article className="mini-job" key={job.id}><span>{job.employmentType.replace("_", " ")}</span><h3>{job.title}</h3><p>{job.location}{job.stipend && <> · {job.stipend}</>}</p><div>{job.applicationUrl ? <a href={job.applicationUrl} target="_blank" rel="noreferrer">Apply <ExternalLink size={13} /></a> : <span className="apply-unavailable">Application unavailable</span>}<button className={job.saved ? "save-button saved" : "save-button"} onClick={() => save(job)} aria-label="Save role"><Bookmark size={17} fill={job.saved ? "currentColor" : "none"} /></button></div></article>) : <div className="side-empty">There are no open campus roles at the moment.</div>}</aside></section>{showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><form className="request-modal review-form" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowForm(false)}>×</button><p className="section-kicker">Share your experience</p><h2>Review {company.name}</h2><label>Your rating<div className="rating-picker">{[1, 2, 3, 4, 5].map((rating) => <button type="button" className={rating <= form.rating ? "active" : ""} onClick={() => setForm({ ...form, rating })} key={rating}><Star fill="currentColor" size={22} /></button>)}</div></label><label>Headline<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} minLength={8} maxLength={160} required placeholder="What should a student know?" /></label><label>Role <small>(optional)</small><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} maxLength={120} placeholder="e.g. Product design intern" /></label><label>What worked well?<textarea value={form.pros} onChange={(event) => setForm({ ...form, pros: event.target.value })} minLength={15} maxLength={5000} required /></label><label>What should students keep in mind? <small>(optional)</small><textarea value={form.cons} onChange={(event) => setForm({ ...form, cons: event.target.value })} maxLength={5000} /></label><label className="check-label"><input type="checkbox" checked={form.isAnonymous} onChange={(event) => setForm({ ...form, isAnonymous: event.target.checked })} /> Publish anonymously</label><button className="button button--red" disabled={sending}>{sending ? "Publishing…" : "Publish review"}</button></form></div>}</main>;
}
