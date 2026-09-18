"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Save, UserRound } from "lucide-react";
import { api } from "@/lib/client-api";

type EditableProfile = { name: string; username: string; email: string; profile: { bio: string | null; college: string | null; campus: string | null; course: string | null; profession: string | null; interests: string[] } | null };

export function ProfileSettingsClient({ initialUser }: { initialUser: EditableProfile }) {
  const [form, setForm] = useState({ name: initialUser.name, bio: initialUser.profile?.bio ?? "", campus: initialUser.profile?.campus ?? "", course: initialUser.profile?.course ?? "", profession: initialUser.profile?.profession ?? "STUDENT", interests: initialUser.profile?.interests.join(", ") ?? "" });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setMessage("");
    const interests = [...new Set(form.interests.split(",").map((item) => item.trim()).filter(Boolean))];
    try {
      await api("/api/users/me", { method: "PATCH", body: JSON.stringify({ name: form.name, bio: form.bio || null, campus: form.campus || null, course: form.course || null, profession: form.profession, interests }) });
      setMessage("Profile saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save your profile."); }
    finally { setPending(false); }
  }
  return <main className="platform-page utility-page settings-page"><div className="settings-intro"><p className="section-kicker"><UserRound size={14} /> Account</p><h1>Your profile</h1><p>Tell your community how you participate and what you care about.</p><small>@{initialUser.username} · {initialUser.email}</small></div><form className="settings-form" onSubmit={submit}><label>Name<input required minLength={2} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div className="profile-college-field"><small>Your shared-living campus</small><b>{initialUser.profile?.college || "No campus selected"}</b><p>Choose a real directory listing to appear in its resident community.</p><Link href="/colleges">Find or list your campus</Link></div><label>Profession<select value={form.profession} onChange={(event) => setForm({ ...form, profession: event.target.value })}><option value="STUDENT">Student</option><option value="TEACHER">Teacher / faculty</option><option value="AUTHORITY">Campus authority</option><option value="ADMINISTRATION">Administration</option><option value="RESIDENT">Resident / community member</option></select></label><label>Campus / locality<input maxLength={120} value={form.campus} onChange={(event) => setForm({ ...form, campus: event.target.value })} placeholder="Campus, locality or area" /></label><label>Course / role<input maxLength={120} value={form.course} onChange={(event) => setForm({ ...form, course: event.target.value })} placeholder="e.g. Faculty, resident, committee member" /></label><label className="settings-form__wide">Bio<textarea maxLength={500} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="A short introduction for your community profile" /></label><label className="settings-form__wide">Interests <small>Comma-separated, up to 20</small><input value={form.interests} onChange={(event) => setForm({ ...form, interests: event.target.value })} placeholder="Food, maintenance, music, football" /></label>{message && <p className={message === "Profile saved." ? "inline-success settings-form__wide" : "inline-error settings-form__wide"}>{message}</p>}<button className="button button--red settings-form__wide" disabled={pending}>{pending ? "Saving…" : <><Save size={16} /> Save profile</>}</button></form></main>;
}
