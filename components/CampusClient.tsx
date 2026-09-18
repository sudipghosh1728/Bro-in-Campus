"use client";

import { CalendarDays, CheckCircle2, CircleHelp, Clock3, MapPin, Plus, Send, Ticket, Wrench } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import type { Viewer } from "@/lib/types";

type CampusEvent = { id: string; title: string; description: string; location: string; startsAt: string; endsAt: string | null; capacity: number | null; kind: string; coverColor: string; goingCount: number; rsvpStatus: "GOING" | "WAITLISTED" | null };
type ServiceRequest = { id: string; title: string; description: string; category: string; location: string | null; status: string; createdAt: string; updatedAt: string };
type CampusData = { events: CampusEvent[]; requests: ServiceRequest[]; support: { open: number; resolved: number } };
const categories = ["MAINTENANCE", "HOSTEL", "TRANSPORT", "IT", "ACADEMIC", "OTHER"] as const;

function dateParts(value: string) { const date = new Date(value); return { month: new Intl.DateTimeFormat("en", { month: "short" }).format(date), day: new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date), time: new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date) }; }
function label(value: string) { return value.split("_").map((piece) => piece[0] + piece.slice(1).toLowerCase()).join(" "); }

export function CampusClient({ initialData, user }: { initialData: CampusData; user: Viewer }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [showRequest, setShowRequest] = useState(false);
  const [request, setRequest] = useState({ title: "", description: "", category: "MAINTENANCE", location: "" });
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function rsvp(event: CampusEvent) {
    if (!user) return router.push("/login?next=/campus");
    const attending = !event.rsvpStatus;
    setData((current) => ({ ...current, events: current.events.map((item) => item.id === event.id ? { ...item, rsvpStatus: attending ? "GOING" : null, goingCount: item.goingCount + (attending ? 1 : -1) } : item) }));
    try {
      const updated = await api<{ attending: boolean; rsvpStatus: CampusEvent["rsvpStatus"]; goingCount: number }>(`/api/campus/events/${event.id}/rsvp`, { method: attending ? "POST" : "DELETE" });
      setData((current) => ({ ...current, events: current.events.map((item) => item.id === event.id ? { ...item, rsvpStatus: updated.rsvpStatus, goingCount: updated.goingCount } : item) }));
    } catch (error) { setData((current) => ({ ...current, events: current.events.map((item) => item.id === event.id ? { ...item, rsvpStatus: event.rsvpStatus, goingCount: event.goingCount } : item) })); setMessage(error instanceof Error ? error.message : "Could not update RSVP."); }
  }

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    if (!user) return router.push("/login?next=/campus");
    setSending(true); setMessage("");
    try {
      const created = await api<ServiceRequest>("/api/campus/requests", { method: "POST", body: JSON.stringify(request) });
      setData((current) => ({ ...current, requests: [created, ...current.requests], support: { ...current.support, open: current.support.open + 1 } }));
      setRequest({ title: "", description: "", category: "MAINTENANCE", location: "" }); setShowRequest(false); setMessage("Request submitted to the campus support desk.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not send your request."); }
    finally { setSending(false); }
  }

  return <main className="app-page campus-page">
    <section className="page-hero page-hero--campus"><div><p className="section-kicker"><CalendarDays size={15} /> Your campus, in one place</p><h1>Less chasing.<br /><em>More belonging.</em></h1><p>RSVP to what matters, keep up with campus essentials, and get help without wondering who to ask.</p><button className="button button--red" onClick={() => setShowRequest(true)}><Plus size={17} /> Get campus help</button></div><div className="campus-hero-card"><span><Clock3 size={17} /> Right now</span><h2>Campus is in<br />full flow.</h2><div><b>{data.events.length}</b><small>upcoming events</small><b>{data.support.open}</b><small>open support requests</small></div></div></section>
    {message && <p className="inline-success page-message">{message}</p>}
    <section className="campus-grid"><div className="events-panel"><div className="list-heading"><div><p className="section-kicker">Plan your week</p><h2>Coming up on campus</h2></div><span>{data.events.length} events</span></div><div className="event-list">{data.events.length ? data.events.map((event) => { const date = dateParts(event.startsAt); return <article className={`campus-event campus-event--${event.coverColor}`} key={event.id}><div className="event-date"><span>{date.month}</span><b>{date.day}</b></div><div className="campus-event__copy"><p>{label(event.kind)} · {date.time}</p><h3>{event.title}</h3><span><MapPin size={14} /> {event.location} <i>·</i> {event.goingCount} going</span></div><button className={event.rsvpStatus ? "rsvp-button active" : "rsvp-button"} onClick={() => rsvp(event)}>{event.rsvpStatus === "WAITLISTED" ? "Waitlisted" : event.rsvpStatus ? <><CheckCircle2 size={15} /> Going</> : <><Ticket size={15} /> RSVP</>}</button></article>; }) : <div className="empty-state"><h2>No events are scheduled.</h2><p>The next updates from student clubs and departments will appear here.</p></div>}</div></div>
      <aside className="campus-side"><div className="transport-card"><p className="section-kicker"><MapPin size={14} /> Campus support</p><h2>Late shuttle?</h2><p>Raise a transport request and keep its status in your campus support list.</p><button onClick={() => { setRequest({ title: "", description: "", category: "TRANSPORT", location: "" }); setShowRequest(true); }}>Report a transport issue</button></div><div className="request-summary"><div className="list-heading"><div><p className="section-kicker">My support</p><h2>Requests</h2></div><button onClick={() => setShowRequest(true)} aria-label="Create support request"><Plus size={18} /></button></div>{user ? data.requests.length ? data.requests.slice(0, 4).map((item) => <div className="request-row" key={item.id}><Wrench size={16} /><div><b>{item.title}</b><small>{label(item.category)} · {new Date(item.createdAt).toLocaleDateString()}</small></div><span className={`request-status request-status--${item.status.toLowerCase()}`}>{label(item.status)}</span></div>) : <div className="side-empty">Nothing open. Campus support requests you create will stay visible here.</div> : <div className="side-empty">Sign in to raise, track and manage campus support requests.</div>}</div></aside>
    </section>
    {showRequest && <div className="modal-backdrop" onMouseDown={() => setShowRequest(false)}><form className="request-modal" onSubmit={submitRequest} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowRequest(false)}>×</button><p className="section-kicker"><CircleHelp size={14} /> Campus support</p><h2>What do you need help with?</h2><p>Give the support desk enough detail to pick this up quickly.</p><label>Short summary<input value={request.title} onChange={(event) => setRequest({ ...request, title: event.target.value })} minLength={6} maxLength={160} required placeholder="e.g. Projector not working" /></label><label>Category<select value={request.category} onChange={(event) => setRequest({ ...request, category: event.target.value as typeof request.category })}>{categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}</select></label><label>Location <small>(optional)</small><input value={request.location} onChange={(event) => setRequest({ ...request, location: event.target.value })} maxLength={160} placeholder="e.g. Library, 2nd floor" /></label><label>What happened?<textarea value={request.description} onChange={(event) => setRequest({ ...request, description: event.target.value })} minLength={15} maxLength={5000} required placeholder="Share what the team needs to know." /></label><button className="button button--red" disabled={sending}>{sending ? "Sending…" : <><Send size={16} /> Send request</>}</button></form></div>}
  </main>;
}
