"use client";

import Link from "next/link";
import { subscribeToRefresh } from "@/lib/live-refresh";
import { Apple, ArrowLeft, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, CircleAlert, ExternalLink, GraduationCap, MapPin, MessageCircleQuestion, Plus, RefreshCw, ShieldCheck, ThumbsUp, UserPlus, UsersRound, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import type { Viewer } from "@/lib/types";
import { Avatar } from "./Avatar";

type Student = { id: string; name: string; username: string; avatarUrl: string | null; course: string | null; campus: string | null; role: string; verified: boolean; followerCount: number; questionCount: number; following: boolean };
type Place = { id: string; name: string; slug: string; city: string; state: string | null; country: string; type: string; website: string | null; description: string | null; address: string | null; latitude: number | null; longitude: number | null; buildingCount: number | null; residentLabel: string | null; coverColor: string; verified: boolean; memberCount: number; joined: boolean; listedBy: { id: string; name: string; username: string } | null; students: Student[] };
type Market = { id: string; name: string; category: string; address: string | null; distanceKm: number | null; source: string; lastSyncedAt: string | null; produce: { id: string; name: string; category: string; availability: string; priceNote: string | null; verifiedAt: string; reportedBy: string | null }[] };
type Issue = { id: string; title: string; description: string; category: string; severity: string; location: string | null; status: string; createdAt: string; updatedAt: string; resolvedAt: string | null; voteCount: number; supported: boolean; reporter: { id: string; name: string; username: string; avatarUrl: string | null } };
type LivingData = { markets: Market[]; issues: Issue[] };
const label = (value: string) => value.split("_").map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");

function PlaceMap({ latitude, longitude, name }: { latitude: number; longitude: number; name: string }) {
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY;
  const googleQuery = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const hasGoogleMaps = Boolean(googleMapsKey);
  const offset = 0.008;
  const bounds = [longitude - offset, latitude - offset, longitude + offset, latitude + offset].map((value) => value.toFixed(6)).join("%2C");
  const marker = `${latitude.toFixed(6)}%2C${longitude.toFixed(6)}`;
  const src = hasGoogleMaps
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleMapsKey!)}&q=${encodeURIComponent(googleQuery)}&zoom=16&maptype=roadmap`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${bounds}&layer=mapnik&marker=${marker}`;
  const openUrl = hasGoogleMaps
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleQuery)}`
    : `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
  return <div className="place-map-frame"><iframe title={`${name} map`} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" src={src} /><div className="place-map-frame__footer"><span>{hasGoogleMaps ? "Google Maps" : "OpenStreetMap fallback"}</span><a href={openUrl} target="_blank" rel="noreferrer">Open larger map <ExternalLink size={12} /></a></div></div>;
}

export function CollegeDetailClient({ initialCollege, initialLiving, user }: { initialCollege: Place; initialLiving: LivingData; user: Viewer }) {
  const router = useRouter();
  const [college, setCollege] = useState(initialCollege);
  const [living, setLiving] = useState(initialLiving);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [produceMarket, setProduceMarket] = useState<Market | null>(null);
  const [issue, setIssue] = useState({ title: "", description: "", category: "MAINTENANCE", severity: "NORMAL", location: "" });
  const [market, setMarket] = useState({ name: "", category: "MARKET", address: "" });
  const [produce, setProduce] = useState({ name: "", category: "VEGETABLE", availability: "IN_STOCK", priceNote: "" });
  const canManageIssues = Boolean(user && (user.role !== "USER" || (college.joined && ["TEACHER", "AUTHORITY", "ADMINISTRATION"].includes(user.profession ?? ""))));

  function requireMember(action: string) {
    if (!user) { router.push(`/login?next=/colleges/${college.slug}`); return false; }
    if (!college.joined) { setMessage(`Join ${college.name} before ${action}.`); return false; }
    return true;
  }

  const refreshLiving = useCallback(async () => { setLiving(await api<LivingData>(`/api/colleges/${college.id}/markets`)); }, [college.id]);

  useEffect(() => {
    return subscribeToRefresh(refreshLiving);
  }, [refreshLiving]);

  async function toggleMembership() {
    if (!user) return router.push(`/login?next=/colleges/${college.slug}`);
    const joined = !college.joined;
    setPending(true); setMessage("");
    try {
      await api(`/api/colleges/${college.id}/join`, { method: joined ? "POST" : "DELETE", body: joined ? JSON.stringify({}) : undefined });
      setCollege((value) => ({ ...value, joined, memberCount: Math.max(0, value.memberCount + (joined ? 1 : -1)) }));
      setMessage(joined ? "You are now part of this shared living community." : "You left this community.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update membership."); }
    finally { setPending(false); }
  }

  function updateMapLocation() {
    if (!user) return router.push(`/login?next=/colleges/${college.slug}`);
    if (college.listedBy?.id !== user.id && user.role === "USER") { setMessage("Only the person who listed this place can update its location."); return; }
    if (!navigator.geolocation) { setMessage("Location is not available in this browser."); return; }
    setPending(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const updated = await api<{ latitude: number; longitude: number; address: string | null }>(`/api/colleges/${college.id}`, { method: "PATCH", body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }) });
        setCollege((current) => ({ ...current, latitude: updated.latitude, longitude: updated.longitude, address: updated.address }));
        setMessage("Location saved. The map and nearby-market search are now available.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the place location."); }
      finally { setPending(false); }
    }, () => { setPending(false); setMessage("Location access was not granted."); }, { enableHighAccuracy: false, timeout: 10000 });
  }

  async function follow(student: Student) {
    if (!user) return router.push(`/login?next=/colleges/${college.slug}`);
    if (student.id === user.id) return;
    const following = !student.following;
    setCollege((value) => ({ ...value, students: value.students.map((item) => item.id === student.id ? { ...item, following, followerCount: item.followerCount + (following ? 1 : -1) } : item) }));
    try { await api(`/api/users/${student.id}/follow`, { method: following ? "POST" : "DELETE" }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update follow."); setCollege(initialCollege); }
  }

  async function syncMarkets() {
    if (!requireMember("syncing nearby markets")) return;
    setSyncing(true); setMessage("");
    try {
      setLiving(await api<LivingData>(`/api/colleges/${college.id}/markets`, { method: "POST", body: JSON.stringify({ action: "sync" }) }));
      setMessage("Nearby markets refreshed from map data. Residents can now verify produce availability.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not sync nearby markets."); }
    finally { setSyncing(false); }
  }

  async function createMarket(event: FormEvent) {
    event.preventDefault();
    if (!requireMember("adding a market")) return;
    setPending(true);
    try {
      await api(`/api/colleges/${college.id}/markets`, { method: "POST", body: JSON.stringify(market) });
      await refreshLiving(); setMarketOpen(false); setMarket({ name: "", category: "MARKET", address: "" }); setMessage("Market added for your community.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add the market."); }
    finally { setPending(false); }
  }

  async function reportProduce(event: FormEvent) {
    event.preventDefault();
    if (!produceMarket || !requireMember("reporting availability")) return;
    setPending(true);
    try {
      await api(`/api/markets/${produceMarket.id}/produce`, { method: "POST", body: JSON.stringify(produce) });
      await refreshLiving(); setProduceMarket(null); setProduce({ name: "", category: "VEGETABLE", availability: "IN_STOCK", priceNote: "" }); setMessage("Availability reported. Your neighbours can see when it was verified.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not report availability."); }
    finally { setPending(false); }
  }

  async function reportIssue(event: FormEvent) {
    event.preventDefault();
    if (!requireMember("reporting an issue")) return;
    setPending(true);
    try {
      await api(`/api/colleges/${college.id}/issues`, { method: "POST", body: JSON.stringify(issue) });
      await refreshLiving(); setIssueOpen(false); setIssue({ title: "", description: "", category: "MAINTENANCE", severity: "NORMAL", location: "" }); setMessage("Issue posted to the shared living board.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not post the issue."); }
    finally { setPending(false); }
  }

  async function toggleSupport(item: Issue) {
    if (!requireMember("supporting an issue")) return;
    const supported = !item.supported;
    setLiving((value) => ({ ...value, issues: value.issues.map((issue) => issue.id === item.id ? { ...issue, supported, voteCount: Math.max(0, issue.voteCount + (supported ? 1 : -1)) } : issue) }));
    try { await api(`/api/issues/${item.id}/vote`, { method: supported ? "POST" : "DELETE" }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update issue support."); await refreshLiving(); }
  }

  async function markIssueDone(item: Issue) {
    if (!canManageIssues) return;
    setPending(true); setMessage("");
    setLiving((value) => ({ ...value, issues: value.issues.map((issue) => issue.id === item.id ? { ...issue, status: "RESOLVED", resolvedAt: new Date().toISOString() } : issue) }));
    try {
      await api(`/api/issues/${item.id}`, { method: "PATCH" });
      setMessage("Issue marked done. The reporter has been notified.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not mark the issue done."); await refreshLiving(); }
    finally { setPending(false); }
  }

  return <main className="app-page college-detail-page">
    <Link className="back-link" href="/colleges"><ArrowLeft size={15} /> All campus communities</Link>
    <section className={`college-profile-hero college-profile-hero--${college.coverColor}`}><div className="college-profile-mark">{college.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</div><div><p className="section-kicker">{label(college.type)} {college.verified && <><i>·</i><ShieldCheck size={14} /> Verified listing</>}</p><h1>{college.name}</h1><p className="college-profile-location"><MapPin size={15} /> {college.address || `${college.city}${college.state ? `, ${college.state}` : ""}`} · {college.country}</p></div><div className="college-profile-actions"><button className={college.joined ? "button button--light" : "button button--dark"} disabled={pending} onClick={toggleMembership}>{college.joined ? <><Check size={16} /> Joined</> : <><UserPlus size={16} /> Join campus</>}</button>{college.website && <a href={college.website} target="_blank" rel="noreferrer" className="college-website">Website <ExternalLink size={13} /></a>}</div></section>
    {message && <p className={message.includes("Could") || message.includes("needs a location") || message.includes("Join ") ? "inline-error page-message" : "inline-success page-message"}>{message}</p>}
    <section className="college-detail-layout"><div><section className="college-story"><p className="section-kicker">About this place</p><h2>Built by residents,<br /><em>useful every day.</em></h2><p>{college.description || "This shared-living place is getting started. Join it to build practical knowledge about markets, amenities and issues that affect everyone."}</p><div className="residence-facts"><span><UsersRound size={15} /><b>{college.memberCount}</b> {college.residentLabel || "residents"}</span>{college.buildingCount && <span><GraduationCap size={15} /><b>{college.buildingCount}</b> buildings</span>}{college.listedBy && <span>Listed by <Link href={`/u/${college.listedBy.username}`}>{college.listedBy.name}</Link></span>}</div></section><section className="place-map-section"><div className="list-heading"><div><p className="section-kicker"><MapPin size={14} /> Place map</p><h2>Where this place is</h2></div>{Boolean(user && (college.listedBy?.id === user.id || user.role === "ADMIN" || user.role === "MODERATOR")) && <button className="small-action" disabled={pending} onClick={updateMapLocation}><MapPin size={14} /> {college.latitude === null ? "Add location" : "Update location"}</button>}</div>{college.latitude !== null && college.longitude !== null ? <PlaceMap latitude={college.latitude} longitude={college.longitude} name={college.name} /> : <div className="empty-state compact-empty"><h2>Map location has not been added.</h2><p>The listing owner can use their device location to enable this map, location-based market distance and nearby market discovery.</p></div>}</section>
      <section className="living-section"><div className="list-heading"><div><p className="section-kicker"><MapPin size={14} /> Local essentials</p><h2>Nearby markets & availability</h2></div><div className="living-actions"><button className="small-action" onClick={syncMarkets} disabled={syncing}>{syncing ? "Refreshing…" : <><RefreshCw size={14} /> Refresh map</>}</button><button className="small-action" onClick={() => requireMember("adding a market") && setMarketOpen(true)}><Plus size={14} /> Add market</button></div></div><p className="living-explainer">Markets come from location-based map data or residents. Fruit and vegetable availability is verified by the people who shop there.</p>{living.markets.length ? <div className="market-list">{living.markets.map((item) => <article className="market-card" key={item.id}><div className="market-card__head"><div><h3>{item.name}</h3><p>{label(item.category)}{item.distanceKm !== null ? ` · ${item.distanceKm} km away` : ""}{item.address ? ` · ${item.address}` : ""}</p></div><button className="small-action" onClick={() => requireMember("reporting availability") && setProduceMarket(item)}><Apple size={13} /> Report stock</button></div>{item.produce.length ? <div className="produce-pills">{item.produce.map((produce) => <span className={`produce-pill produce-pill--${produce.availability.toLowerCase()}`} key={produce.id}><b>{produce.name}</b> · {label(produce.availability)}{produce.priceNote ? ` · ${produce.priceNote}` : ""}</span>)}</div> : <p className="market-empty">No stock updates yet. Add the first fruit or vegetable report after a visit.</p>}</article>)}</div> : <div className="empty-state compact-empty"><h2>No local markets saved yet.</h2><p>{college.latitude === null ? "This listing needs location coordinates before map discovery can run. Residents can still add markets manually." : "Refresh map data to find nearby markets, or add one manually."}</p></div>}</section>
      <section className="living-section issue-board"><div className="list-heading"><div><p className="section-kicker"><CircleAlert size={14} /> Shared issue board</p><h2>Problems everyone can see</h2></div><button className="button button--red issue-button" onClick={() => requireMember("reporting an issue") && setIssueOpen(true)}><Plus size={15} /> Report an issue</button></div><p className="living-explainer">Report a problem once, let neighbours support it, and make shared priorities visible instead of repeating private messages.</p>{canManageIssues && <p className="issue-manager-note"><CheckCircle2 size={15} /> You receive new reports for this campus and can mark resolved work done.</p>}{living.issues.length ? <div className="issue-list">{living.issues.map((item) => <article className={`issue-card issue-card--${item.severity.toLowerCase()} ${item.status === "RESOLVED" ? "issue-card--resolved" : ""}`} key={item.id}><div><span>{label(item.category)} · {label(item.severity)} · {label(item.status)}</span><h3>{item.title}</h3><p>{item.description}</p><small>{item.location ? `${item.location} · ` : ""}Reported by <Link href={`/u/${item.reporter.username}`}>{item.reporter.name}</Link> · {new Date(item.createdAt).toLocaleDateString()}{item.resolvedAt ? ` · Done ${new Date(item.resolvedAt).toLocaleDateString()}` : ""}</small></div><div className="issue-card__actions"><button className={item.supported ? "issue-support active" : "issue-support"} onClick={() => toggleSupport(item)}><ThumbsUp size={15} /><b>{item.voteCount}</b><span>{item.supported ? "Supporting" : "Support"}</span></button>{canManageIssues && item.status !== "RESOLVED" && <button className="issue-done" disabled={pending} onClick={() => markIssueDone(item)}><CheckCircle2 size={15} /> Mark done</button>}</div></article>)}</div> : <div className="empty-state compact-empty"><h2>No shared issues right now.</h2><p>When something affects the residence, post it here so everyone has the same context.</p></div>}</section>
      <section className="college-people"><div className="list-heading"><div><p className="section-kicker">People here</p><h2>Residents at {college.name}</h2></div><span>{college.memberCount} members</span></div>{college.students.length ? <div className="student-grid">{college.students.map((student) => <article className="student-card" key={student.id}><Link href={`/u/${student.username}`}><Avatar name={student.name} src={student.avatarUrl} size="md" /></Link><div className="student-card__copy"><Link href={`/u/${student.username}`}><h3>{student.name}</h3></Link><p>{student.course || college.residentLabel || "Resident"}</p><small>{student.questionCount} discussions · {student.followerCount} followers</small></div>{user?.id !== student.id && <button className={student.following ? "student-follow following" : "student-follow"} onClick={() => follow(student)}>{student.following ? "Following" : "Follow"}</button>}</article>)}</div> : <div className="empty-state"><h2>Be the first resident here.</h2><p>Join this place to start a shared living community.</p></div>}</section></div>
      <aside className="college-detail-side"><div className="college-stat-card"><UsersRound size={18} /><b>{college.memberCount}</b><span>{college.residentLabel || "residents"} connected</span><GraduationCap size={18} /><p>Market availability and shared issues live beside the wider Bro in Campus community.</p></div><Link href="/community" className="college-module-link"><MessageCircleQuestion size={18} /><div><b>Community</b><small>Ask, answer and share local knowledge</small></div></Link><Link href="/campus" className="college-module-link"><CalendarDays size={18} /><div><b>Events & support</b><small>Campus life and service requests</small></div></Link><Link href="/careers" className="college-module-link"><BriefcaseBusiness size={18} /><div><b>Careers</b><small>Roles, companies and student reviews</small></div></Link></aside>
    </section>
    {issueOpen && <div className="modal-backdrop" onMouseDown={() => setIssueOpen(false)}><form className="request-modal living-modal" onSubmit={reportIssue} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setIssueOpen(false)}><X size={17} /></button><p className="section-kicker"><CircleAlert size={14} /> Shared issue</p><h2>What needs attention?</h2><p>Every report is visible to members of this place. Describe the problem so neighbours can add context and support it.</p><label>Short title<input required minLength={6} maxLength={180} value={issue.title} onChange={(event) => setIssue({ ...issue, title: event.target.value })} placeholder="e.g. Water pressure is low in Block B" /></label><div className="form-two"><label>Category<select value={issue.category} onChange={(event) => setIssue({ ...issue, category: event.target.value })}>{["WATER", "ELECTRICITY", "CLEANLINESS", "SAFETY", "NOISE", "MAINTENANCE", "TRANSPORT", "OTHER"].map((value) => <option key={value}>{label(value)}</option>)}</select></label><label>Priority<select value={issue.severity} onChange={(event) => setIssue({ ...issue, severity: event.target.value })}>{["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => <option key={value}>{label(value)}</option>)}</select></label></div><label>Location <small>(optional)</small><input maxLength={180} value={issue.location} onChange={(event) => setIssue({ ...issue, location: event.target.value })} placeholder="e.g. Block B, fourth floor" /></label><label>What happened?<textarea required minLength={15} maxLength={5000} value={issue.description} onChange={(event) => setIssue({ ...issue, description: event.target.value })} placeholder="Share the useful details." /></label><button className="button button--red" disabled={pending}>{pending ? "Posting…" : "Post to shared board"}</button></form></div>}
    {marketOpen && <div className="modal-backdrop" onMouseDown={() => setMarketOpen(false)}><form className="request-modal living-modal" onSubmit={createMarket} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setMarketOpen(false)}><X size={17} /></button><p className="section-kicker"><MapPin size={14} /> Local essentials</p><h2>Add a nearby market</h2><p>Help neighbours find a useful local shop. You can add stock availability after saving it.</p><label>Market name<input required minLength={2} maxLength={160} value={market.name} onChange={(event) => setMarket({ ...market, name: event.target.value })} placeholder="e.g. Green Basket" /></label><label>Kind<select value={market.category} onChange={(event) => setMarket({ ...market, category: event.target.value })}>{["MARKET", "GROCERY", "GREENGROCER", "SUPERMARKET", "MARKETPLACE"].map((value) => <option key={value}>{label(value)}</option>)}</select></label><label>Address <small>(optional)</small><input maxLength={300} value={market.address} onChange={(event) => setMarket({ ...market, address: event.target.value })} placeholder="Street, landmark or market area" /></label><button className="button button--red" disabled={pending}>{pending ? "Adding…" : "Add market"}</button></form></div>}
    {produceMarket && <div className="modal-backdrop" onMouseDown={() => setProduceMarket(null)}><form className="request-modal living-modal" onSubmit={reportProduce} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setProduceMarket(null)}><X size={17} /></button><p className="section-kicker"><Apple size={14} /> Community stock update</p><h2>What did you find?</h2><p>Report what was available at {produceMarket.name}. Timestamped reports are shared with this place.</p><label>Item<input required minLength={2} maxLength={100} value={produce.name} onChange={(event) => setProduce({ ...produce, name: event.target.value })} placeholder="e.g. Tomatoes" /></label><div className="form-two"><label>Category<select value={produce.category} onChange={(event) => setProduce({ ...produce, category: event.target.value })}>{["VEGETABLE", "FRUIT", "GROCERY", "OTHER"].map((value) => <option key={value}>{label(value)}</option>)}</select></label><label>Availability<select value={produce.availability} onChange={(event) => setProduce({ ...produce, availability: event.target.value })}>{["IN_STOCK", "LIMITED", "OUT_OF_STOCK"].map((value) => <option key={value}>{label(value)}</option>)}</select></label></div><label>Price note <small>(optional)</small><input maxLength={100} value={produce.priceNote} onChange={(event) => setProduce({ ...produce, priceNote: event.target.value })} placeholder="e.g. ₹40/kg" /></label><button className="button button--red" disabled={pending}>{pending ? "Saving…" : "Share availability"}</button></form></div>}
  </main>;
}
