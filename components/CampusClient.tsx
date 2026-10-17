"use client";

import { CalendarDays, CheckCircle2, CircleHelp, Clock3, MapPin, Plus, Send, Ticket, Upload, Wrench } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import type { Viewer } from "@/lib/types";

type CampusEvent = { id: string; title: string; description: string; location: string; startsAt: string; endsAt: string | null; capacity: number | null; kind: string; coverColor: string; goingCount: number; rsvpStatus: "GOING" | "WAITLISTED" | null; timeline: "UPCOMING" | "LIVE" | "PAST" };
type ServiceRequest = { id: string; title: string; description: string; category: string; location: string | null; status: string; createdAt: string; updatedAt: string };
type CampusData = { events: CampusEvent[]; requests: ServiceRequest[]; support: { open: number; resolved: number } };
const categories = ["MAINTENANCE", "HOSTEL", "TRANSPORT", "IT", "ACADEMIC", "OTHER"] as const;

function dateParts(value: string) { const date = new Date(value); return { month: new Intl.DateTimeFormat("en", { month: "short" }).format(date), day: new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date), time: new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date) }; }
function label(value: string) { return value.split("_").map((piece) => piece[0] + piece.slice(1).toLowerCase()).join(" "); }

export function CampusClient({ initialData, user }: { initialData: CampusData; user: Viewer }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [showRequest, setShowRequest] = useState(false);
  const [showEvent, setShowEvent] = useState(false);
  const [request, setRequest] = useState({ title: "", description: "", category: "MAINTENANCE", location: "" });
  const [eventDraft, setEventDraft] = useState({ title: "", description: "", location: "", startsAt: "", endsAt: "", capacity: "", kind: "WORKSHOP", coverColor: "violet" });
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

  async function submitEvent(event: FormEvent) {
    event.preventDefault();
    if (!user) return router.push("/login?next=/campus");
    setSending(true); setMessage("");
    try {
      await api("/api/campus/events", { method: "POST", body: JSON.stringify({ ...eventDraft, startsAt: new Date(eventDraft.startsAt).toISOString(), endsAt: eventDraft.endsAt ? new Date(eventDraft.endsAt).toISOString() : null, capacity: eventDraft.capacity ? Number(eventDraft.capacity) : null }) });
      const events = await api<CampusEvent[]>("/api/campus/events");
      setData((current) => ({ ...current, events }));
      setEventDraft({ title: "", description: "", location: "", startsAt: "", endsAt: "", capacity: "", kind: "WORKSHOP", coverColor: "violet" }); setShowEvent(false); setMessage("Event submitted to the campus calendar.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not publish the event."); }
    finally { setSending(false); }
  }

  return <main className="app-page campus-page">
    <section className="page-hero page-hero--campus"><div><p className="section-kicker"><CalendarDays size={15} /> Your campus, in one place</p><h1>Less chasing.<br /><em>More belonging.</em></h1><p>RSVP to what matters, publish a student event, keep up with campus essentials, and get help without wondering who to ask.</p><div className="campus-hero-actions"><button className="button button--red" onClick={() => user ? setShowEvent(true) : router.push("/login?next=/campus")}><Upload size={17} /> Publish an event</button><button className="text-action" onClick={() => setShowRequest(true)}><Plus size={16} /> Get campus help</button></div></div><div className="campus-hero-card"><span><Clock3 size={17} /> Right now</span><h2>Campus is in<br />full flow.</h2><div><b>{data.events.length}</b><small>upcoming events</small><b>{data.support.open}</b><small>open support requests</small></div></div></section>
    {message && <p className={message.includes("Could") || message.includes("blocked") ? "inline-error page-message" : "inline-success page-message"}>{message}</p>}
    <section className="campus-grid"><div className="events-panel"><div className="list-heading"><div><p className="section-kicker">Plan your week</p><h2>Coming up on campus</h2></div><button className="small-action" onClick={() => user ? setShowEvent(true) : router.push("/login?next=/campus")}><Plus size={14} /> Add event</button></div><div className="event-list">{data.events.length ? data.events.map((event) => { const date = dateParts(event.startsAt); return <article className={`campus-event campus-event--${event.coverColor}`} key={event.id}><div className="event-date"><span>{date.month}</span><b>{date.day}</b></div><div className="campus-event__copy"><p>{event.timeline === "LIVE" ? "Happening now" : label(event.kind)} · {date.time}</p><h3>{event.title}</h3><span><MapPin size={14} /> {event.location} <i>·</i> {event.goingCount} going</span></div><button className={event.rsvpStatus ? "rsvp-button active" : "rsvp-button"} onClick={() => rsvp(event)}>{event.rsvpStatus === "WAITLISTED" ? "Waitlisted" : event.rsvpStatus ? <><CheckCircle2 size={15} /> Going</> : <><Ticket size={15} /> RSVP</>}</button></article>; }) : <div className="empty-state"><h2>No events are scheduled.</h2><p>Publish the next update from your club or department.</p></div>}</div></div>
      <aside className="campus-side"><div className="transport-card"><p className="section-kicker"><MapPin size={14} /> Campus support</p><h2>Late shuttle?</h2><p>Raise a transport request and keep its status in your campus support list.</p><button onClick={() => { setRequest({ title: "", description: "", category: "TRANSPORT", location: "" }); setShowRequest(true); }}>Report a transport issue</button></div><div className="request-summary"><div className="list-heading"><div><p className="section-kicker">My support</p><h2>Requests</h2></div><button onClick={() => setShowRequest(true)} aria-label="Create support request"><Plus size={18} /></button></div>{user ? data.requests.length ? data.requests.slice(0, 4).map((item) => <div className="request-row" key={item.id}><Wrench size={16} /><div><b>{item.title}</b><small>{label(item.category)} · {new Date(item.createdAt).toLocaleDateString()}</small></div><span className={`request-status request-status--${item.status.toLowerCase()}`}>{label(item.status)}</span></div>) : <div className="side-empty">Nothing open. Campus support requests you create will stay visible here.</div> : <div className="side-empty">Sign in to raise, track and manage campus support requests.</div>}</div></aside>
    </section>
    {showRequest && <div className="modal-backdrop" onMouseDown={() => setShowRequest(false)}><form className="request-modal" onSubmit={submitRequest} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowRequest(false)}>×</button><p className="section-kicker"><CircleHelp size={14} /> Campus support</p><h2>What do you need help with?</h2><p>Give the support desk enough detail to pick this up quickly.</p><label>Short summary<input value={request.title} onChange={(event) => setRequest({ ...request, title: event.target.value })} minLength={6} maxLength={160} required placeholder="e.g. Projector not working" /></label><label>Category<select value={request.category} onChange={(event) => setRequest({ ...request, category: event.target.value as typeof request.category })}>{categories.map((category) => <option key={category} value={category}>{label(category)}</option>)}</select></label><label>Location <small>(optional)</small><input value={request.location} onChange={(event) => setRequest({ ...request, location: event.target.value })} maxLength={160} placeholder="e.g. Library, 2nd floor" /></label><label>What happened?<textarea value={request.description} onChange={(event) => setRequest({ ...request, description: event.target.value })} minLength={15} maxLength={5000} required placeholder="Share what the team needs to know." /></label><button className="button button--red" disabled={sending}>{sending ? "Sending…" : <><Send size={16} /> Send request</>}</button></form></div>}
    {showEvent && <div className="modal-backdrop" onMouseDown={() => setShowEvent(false)}><form className="request-modal" onSubmit={submitEvent} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowEvent(false)}>×</button><p className="section-kicker"><CalendarDays size={14} /> Campus calendar</p><h2>Put something on the calendar.</h2><p>Share a real upcoming club, department or campus event. Public listings are screened for community safety before publishing.</p><label>Event title<input value={eventDraft.title} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} minLength={6} maxLength={180} required placeholder="e.g. Robotics club open build night" /></label><div className="form-two"><label>Kind<select value={eventDraft.kind} onChange={(event) => setEventDraft({ ...eventDraft, kind: event.target.value })}>{["WORKSHOP", "FEST", "SPORTS", "CAREER", "CULTURAL", "CLUB", "OTHER"].map((kind) => <option key={kind}>{label(kind)}</option>)}</select></label><label>Capacity <small>(optional)</small><input type="number" min="1" max="100000" value={eventDraft.capacity} onChange={(event) => setEventDraft({ ...eventDraft, capacity: event.target.value })} placeholder="e.g. 60" /></label></div><label>Location<input value={eventDraft.location} onChange={(event) => setEventDraft({ ...eventDraft, location: event.target.value })} minLength={2} maxLength={180} required placeholder="e.g. Innovation Lab" /></label><div className="form-two"><label>Starts<input type="datetime-local" value={eventDraft.startsAt} onChange={(event) => setEventDraft({ ...eventDraft, startsAt: event.target.value })} required /></label><label>Ends <small>(optional)</small><input type="datetime-local" value={eventDraft.endsAt} onChange={(event) => setEventDraft({ ...eventDraft, endsAt: event.target.value })} /></label></div><label>What can students expect?<textarea value={eventDraft.description} onChange={(event) => setEventDraft({ ...eventDraft, description: event.target.value })} minLength={15} maxLength={5000} required placeholder="Share useful details, who it is for and what to bring." /></label><button className="button button--red" disabled={sending}>{sending ? "Publishing…" : <><Upload size={16} /> Publish event</>}</button></form></div>}
  </main>;
}
