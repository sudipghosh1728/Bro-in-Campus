"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { GraduationCap, Pencil } from "lucide-react";
import { api } from "@/lib/client-api";
import type { DepartmentOption } from "@/lib/growth-types";

export function CollegeDepartments({ collegeId, initialDepartments, catalog, canEdit }: {
  collegeId: string;
  initialDepartments: DepartmentOption[];
  catalog: DepartmentOption[];
  canEdit: boolean;
}) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [selected, setSelected] = useState(initialDepartments.map((item) => item.slug));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const result = await api<{ departments: DepartmentOption[] }>(`/api/colleges/${collegeId}/departments`, {
        method: "PUT", body: JSON.stringify({ departmentSlugs: selected }),
      });
      setDepartments(result.departments); setEditing(false); setNotice("Academic groups updated.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save academic groups.");
    } finally { setSaving(false); }
  }

  return <section className="college-departments college-departments--editable" aria-labelledby="college-departments-title">
    <div className="list-heading"><div><p className="section-kicker"><GraduationCap size={14} /> Academic groups</p><h2 id="college-departments-title">Find your direction here</h2></div>
      {canEdit && !editing && <button className="small-action" onClick={() => { setSelected(departments.map((item) => item.slug)); setError(""); setNotice(""); setEditing(true); }}><Pencil size={14} /> Edit groups</button>}
    </div>
    <p className="living-explainer">Broad discipline groups selected by the listing owner or a platform moderator—not a verified course directory. Check the college website for exact departments and admissions.</p>
    {editing ? <form onSubmit={save}>
      <fieldset className="department-checkboxes" disabled={saving}><legend>Which groups does this campus support?</legend>
        {catalog.map((item) => <label key={item.id}><input type="checkbox" checked={selected.includes(item.slug)} disabled={!selected.includes(item.slug) && selected.length >= 12} onChange={() => setSelected((current) => current.includes(item.slug) ? current.filter((slug) => slug !== item.slug) : [...current, item.slug])} />{item.name}</label>)}
      </fieldset>
      {!catalog.length && <p>No discipline groups are available yet.</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="department-editor-actions"><button className="button button--dark" disabled={saving}>{saving ? "Saving…" : "Save groups"}</button><button className="small-action" type="button" disabled={saving} onClick={() => setEditing(false)}>Cancel</button></div>
    </form> : <div className="college-department-links">
      {departments.map((item) => <Link href={`/learn?department=${encodeURIComponent(item.slug)}`} key={item.id} className={`college-department-pill college-department-pill--${item.accent}`}><b>{item.name}</b><small>{item.focusAreas.slice(0, 2).join(" · ")}</small></Link>)}
      {!departments.length && <p>No academic groups have been listed yet. <Link href="/learn">Explore all learning pathways</Link>.</p>}
    </div>}
    <p className="department-editor-status" role="status">{notice}</p>
  </section>;
}
