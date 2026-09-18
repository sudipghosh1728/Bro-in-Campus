"use client";

import Link from "next/link";
import { ArrowRight, Building2, MapPin, Plus, Search, ShieldCheck, UsersRound, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import type { Viewer } from "@/lib/types";

type College = {
  id: string; name: string; slug: string; city: string; state: string | null; country: string; type: string; website: string | null;
  description: string | null; coverColor: string; verified: boolean; memberCount: number; joined: boolean; createdAt: string;
};
type CollegeData = { colleges: College[] };
type Institution = { aisheCode: string; name: string; state: string; district: string | null };

const collegeTypes = ["COLLEGE", "UNIVERSITY", "HOSTEL", "CAMPUS", "SOCIETY", "APARTMENT", "INSTITUTE", "SCHOOL", "OTHER"];
const colors = ["indigo", "violet", "mint", "coral", "yellow"];
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

export function CollegeDirectoryClient({ initialData, user, initialQuery }: { initialData: CollegeData; user: Viewer; initialQuery: string }) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState(initialQuery);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<{ name: string; city: string; state: string; country: string; type: string; website: string; description: string; aisheCode: string; address: string; buildingCount: number | null; residentLabel: string; latitude: number | null; longitude: number | null; coverColor: string }>({ name: "", city: "", state: "", country: "India", type: "COLLEGE", website: "", description: "", aisheCode: "", address: "", buildingCount: null, residentLabel: "", latitude: null, longitude: null, coverColor: "indigo" });
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionLoading, setInstitutionLoading] = useState(false);

  useEffect(() => {
    const value = institutionQuery.trim();
    if (value.length < 2) { setInstitutions([]); return; }
    const timer = window.setTimeout(async () => {
      setInstitutionLoading(true);
      try { setInstitutions((await api<{ institutions: Institution[] }>(`/api/institutions?q=${encodeURIComponent(value)}`)).institutions); }
      catch (error) { setMessage(error instanceof Error ? error.message : "Could not search the institution directory."); }
      finally { setInstitutionLoading(false); }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [institutionQuery]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setMessage("");
    try {
      const next = await api<CollegeData>(`/api/colleges?q=${encodeURIComponent(query)}`);
      setData(next);
      router.replace(query ? `/colleges?q=${encodeURIComponent(query)}` : "/colleges", { scroll: false });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not search colleges."); }
    finally { setLoading(false); }
  }

  function openListing() {
    if (!user) return router.push("/login?next=/colleges");
    setMessage(""); setShowForm(true);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setMessage("Location is not available in this browser. You can still add markets manually."); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setForm((current) => ({ ...current, latitude: coords.latitude, longitude: coords.longitude })); setMessage("Location added. Nearby market discovery will be available after listing."); },
      () => setMessage("Location access was not granted. You can still add the place and markets manually."),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  function chooseInstitution(institution: Institution) {
    setForm((current) => ({ ...current, name: institution.name, city: institution.district ?? current.city, state: institution.state, country: "India", type: current.type === "UNIVERSITY" ? "UNIVERSITY" : "COLLEGE", aisheCode: institution.aisheCode }));
    setInstitutionQuery(institution.name);
    setInstitutions([]);
  }

  async function submitListing(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setMessage("");
    try {
      const created = await api<{ slug: string }>("/api/colleges", { method: "POST", body: JSON.stringify(form) });
      router.push(`/colleges/${created.slug}`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not list this campus."); }
    finally { setSaving(false); }
  }

  return <main className="app-page colleges-page">
    <section className="directory-hero">
      <div><p className="section-kicker"><Building2 size={15} /> Shared-living directory</p><h1>Find your<br /><em>campus community.</em></h1><p>List a college, hostel, campus, housing society or apartment community. Build a living home for the people who share it—not a brochure page.</p></div>
      <aside><Building2 size={23} /><b>{data.colleges.length}</b><span>campuses in the network</span><UsersRound size={18} /><small>Join the people who share your everyday life.</small></aside>
    </section>
    <section className="directory-toolbar">
      <form className="search-bar" onSubmit={search}><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by college, city, or state" /><button className="button button--dark" disabled={loading}>{loading ? "Searching…" : "Search"}</button></form>
      <button className="button button--red" onClick={openListing}><Plus size={17} /> List your campus</button>
    </section>
    {message && <p className="inline-error page-message">{message}</p>}
    <section className="college-directory-list" aria-live="polite">
      <div className="list-heading"><div><p className="section-kicker">Resident-built directory</p><h2>{query ? `Results for “${query}”` : "Campus communities people are building"}</h2></div><span>{data.colleges.length} listed</span></div>
      {data.colleges.length ? <div className="college-grid">{data.colleges.map((college) => <Link className={`college-card college-card--${college.coverColor}`} href={`/colleges/${college.slug}`} key={college.id}>
        <div className="college-card__top"><span className="college-mark">{college.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>{college.verified && <small><ShieldCheck size={13} /> Verified</small>}</div>
        <div><p>{label(college.type)}</p><h3>{college.name}</h3><span><MapPin size={14} /> {college.city}{college.state ? `, ${college.state}` : ""}</span></div>
        <footer><b><UsersRound size={14} /> {college.memberCount} {college.memberCount === 1 ? "resident" : "residents"}</b><span>{college.joined ? "Your campus" : <><span>Open campus</span><ArrowRight size={15} /></>}</span></footer>
      </Link>)}</div> : <div className="empty-state directory-empty"><h2>No matching campus yet.</h2><p>Be the first person to add it to the shared-living network.</p><button className="button button--red" onClick={openListing}>List this campus</button></div>}
    </section>
    {showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><form className="request-modal college-form" onSubmit={submitListing} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setShowForm(false)} aria-label="Close"><X size={17} /></button><p className="section-kicker"><Building2 size={14} /> Resident-submitted listing</p><h2>List your shared-living place</h2><p>Anyone can begin a listing for a college, hostel, campus or society. Members add the practical information that makes daily life easier.</p><div className="form-two"><label>Place type<select value={form.type} onChange={(event) => { const type = event.target.value; setForm({ ...form, type, aisheCode: ["COLLEGE", "UNIVERSITY", "INSTITUTE"].includes(type) ? form.aisheCode : "" }); }}>{collegeTypes.map((type) => <option key={type}>{label(type)}</option>)}</select></label><label>Number of buildings <small>(optional)</small><input type="number" min={1} max={10000} value={form.buildingCount ?? ""} onChange={(event) => setForm({ ...form, buildingCount: event.target.value ? Number(event.target.value) : null })} placeholder="e.g. 8" /></label></div>{["COLLEGE", "UNIVERSITY", "INSTITUTE"].includes(form.type) && <div className="institution-picker"><label>Choose from India&apos;s AISHE directory<input value={institutionQuery} onChange={(event) => { setInstitutionQuery(event.target.value); setForm({ ...form, aisheCode: "" }); }} placeholder="Search a university or college" autoComplete="off" /></label>{institutionLoading && <small>Searching institutions…</small>}{institutions.length > 0 && <div className="institution-options" role="listbox">{institutions.map((institution) => <button type="button" onClick={() => chooseInstitution(institution)} key={institution.aisheCode} role="option"><b>{institution.name}</b><small>{institution.district ? `${institution.district}, ` : ""}{institution.state} · {institution.aisheCode}</small></button>)}</div>}{form.aisheCode && <p className="institution-selected">AISHE institution selected: {form.aisheCode}</p>}</div>}<label>Place name<input required minLength={3} maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, aisheCode: "" })} placeholder="e.g. Green View Housing Society" /></label><div className="form-two"><label>City<input required minLength={2} maxLength={100} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="City" /></label><label>State <small>(optional)</small><input maxLength={100} value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} placeholder="State" /></label></div><label>Address <small>(optional)</small><input maxLength={300} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Street, landmark or full address" /></label><div className="form-two"><label>Resident name <small>(optional)</small><input maxLength={40} value={form.residentLabel} onChange={(event) => setForm({ ...form, residentLabel: event.target.value })} placeholder="e.g. residents, boarders" /></label><label>Website <small>(optional)</small><input type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://example.org" /></label></div><div className="listing-location"><div><b>Location for nearby markets</b><small>{form.latitude === null ? "Use your device location to enable distance-based market discovery." : `Location added: ${form.latitude.toFixed(4)}, ${form.longitude?.toFixed(4)}`}</small></div><button type="button" className="small-action" onClick={useCurrentLocation}><MapPin size={14} /> Use my location</button></div><label>What should neighbours know? <small>(optional)</small><textarea minLength={20} maxLength={1200} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the place and what would be useful for the people who live here." /></label><label>Listing colour<select value={form.coverColor} onChange={(event) => setForm({ ...form, coverColor: event.target.value })}>{colors.map((color) => <option key={color} value={color}>{label(color)}</option>)}</select></label><button className="button button--red" disabled={saving}>{saving ? "Creating listing…" : <><Plus size={16} /> Publish place listing</>}</button></form></div>}
  </main>;
}
