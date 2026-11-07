"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";

export type ManagedCollege = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string | null;
  country: string;
  type: string;
  website: string | null;
  description: string | null;
  aisheCode: string | null;
  address: string | null;
  buildingCount: number | null;
  residentLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  coverColor: string;
  verified: boolean;
  _count: { members: number };
};

type CollegeForm = {
  name: string;
  city: string;
  state: string;
  country: string;
  type: string;
  website: string;
  description: string;
  aisheCode: string;
  address: string;
  buildingCount: string;
  residentLabel: string;
  latitude: string;
  longitude: string;
  coverColor: string;
  verified: boolean;
};
const emptyForm: CollegeForm = {
  name: "", city: "", state: "", country: "India", type: "COLLEGE", website: "", description: "", aisheCode: "",
  address: "", buildingCount: "", residentLabel: "", latitude: "", longitude: "", coverColor: "indigo", verified: false,
};
const types = ["COLLEGE", "UNIVERSITY", "HOSTEL", "CAMPUS", "SOCIETY", "APARTMENT", "INSTITUTE", "SCHOOL", "OTHER"];
const colors = ["indigo", "violet", "mint", "coral", "yellow"];

function toPayload(form: CollegeForm) {
  return {
    ...form,
    state: form.state || "",
    website: form.website || "",
    description: form.description || "",
    aisheCode: form.aisheCode || "",
    address: form.address || "",
    residentLabel: form.residentLabel || "",
    buildingCount: form.buildingCount ? Number(form.buildingCount) : null,
    latitude: form.latitude ? Number(form.latitude) : null,
    longitude: form.longitude ? Number(form.longitude) : null,
  };
}

export function AdminColleges({ initialColleges }: { initialColleges?: ManagedCollege[] }) {
  const [colleges, setColleges] = useState<ManagedCollege[]>(initialColleges ?? []);
  const [form, setForm] = useState<CollegeForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(!initialColleges);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (search = "") => {
    setLoading(true);
    try {
      const result = await api<ManagedCollege[]>(`/api/admin/colleges?take=100${search ? `&q=${encodeURIComponent(search)}` : ""}`);
      setColleges(result);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load colleges.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!initialColleges) void load(); }, [initialColleges, load]);

  function edit(college: ManagedCollege) {
    setEditingId(college.id);
    setForm({
      name: college.name, city: college.city, state: college.state ?? "", country: college.country, type: college.type,
      website: college.website ?? "", description: college.description ?? "", aisheCode: college.aisheCode ?? "",
      address: college.address ?? "", buildingCount: college.buildingCount?.toString() ?? "", residentLabel: college.residentLabel ?? "",
      latitude: college.latitude?.toString() ?? "", longitude: college.longitude?.toString() ?? "", coverColor: college.coverColor, verified: college.verified,
    });
    setMessage("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await api(editingId ? `/api/admin/colleges/${editingId}` : "/api/admin/colleges", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(toPayload(form)),
      });
      resetForm();
      await load(query);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save college.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(college: ManagedCollege) {
    if (!window.confirm(`Delete ${college.name} and its memberships, local markets, and issue-board data? This cannot be undone.`)) return;
    setMessage("");
    try {
      await api(`/api/admin/colleges/${college.id}`, { method: "DELETE" });
      if (editingId === college.id) resetForm();
      await load(query);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete college.");
    }
  }

  return <section className="admin-section admin-colleges">
    <div className="section-title"><h2>College directory</h2><form className="admin-search" onSubmit={(event) => { event.preventDefault(); load(query); }}><input aria-label="Search colleges" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search colleges" /><button>Search</button></form></div>
    {message && <p className="inline-error">{message}</p>}
    <form className="admin-college-form" onSubmit={save}>
      <h3>{editingId ? "Edit college" : "Add a college"}</h3>
      <label>Name<input required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>City<input required maxLength={100} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
      <label>State<input maxLength={100} value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} /></label>
      <label>Country<input required maxLength={100} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></label>
      <label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
      <label>Website<input type="url" maxLength={300} value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label>
      <label>AISHE code<input maxLength={20} value={form.aisheCode} onChange={(event) => setForm({ ...form, aisheCode: event.target.value })} /></label>
      <label>Address<input maxLength={300} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
      <label>Buildings<input type="number" min={1} max={10000} value={form.buildingCount} onChange={(event) => setForm({ ...form, buildingCount: event.target.value })} /></label>
      <label>Resident label<input maxLength={40} value={form.residentLabel} onChange={(event) => setForm({ ...form, residentLabel: event.target.value })} /></label>
      <label>Latitude<input type="number" min={-90} max={90} step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></label>
      <label>Longitude<input type="number" min={-180} max={180} step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></label>
      <label>Cover color<select value={form.coverColor} onChange={(event) => setForm({ ...form, coverColor: event.target.value })}>{colors.map((color) => <option key={color} value={color}>{color}</option>)}</select></label>
      <label className="admin-college-form__wide">Description<textarea maxLength={1200} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <label className="admin-college-form__check"><input type="checkbox" checked={form.verified} onChange={(event) => setForm({ ...form, verified: event.target.checked })} /> Verified listing</label>
      <div className="admin-college-form__actions"><button disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create college"}</button>{editingId && <button type="button" onClick={resetForm}>Cancel edit</button>}</div>
    </form>
    {loading ? <p className="page-message">Loading colleges…</p> : colleges.length ? <div className="admin-table">{colleges.map((college) => <div className="admin-row admin-college-row" key={college.id}><span><b>{college.name}</b><small>{college.city}{college.state ? `, ${college.state}` : ""} · {college.slug}</small></span><small>{college._count.members} members</small><small>{college.verified ? "Verified" : "Unverified"}</small><button onClick={() => edit(college)}>Edit</button><button className="admin-suspend" onClick={() => remove(college)}>Delete</button></div>)}</div> : <p className="empty-state">No colleges found.</p>}
  </section>;
}
