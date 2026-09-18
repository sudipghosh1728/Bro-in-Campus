"use client";

import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client-api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", profession: "STUDENT" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";
  const resetComplete = searchParams.get("reset") === "1";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body: JSON.stringify(isRegister ? form : { email: form.email, password: form.password }) });
      router.push(searchParams.get("next") || "/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not continue.");
    } finally {
      setPending(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-promise">
      <p className="section-kicker">Bro in Campus</p>
      <h1>Your campus works<br /><em>better together.</em></h1>
      <p>Thoughtful conversations, practical essentials and career intelligence—made useful by the people who live and support campus life.</p>
      <div><span>01 <b>Ask honestly</b></span><span>02 <b>Show up together</b></span><span>03 <b>Choose confidently</b></span></div>
    </section>
    <section className="auth-panel">
      <div className="auth-form-wrap">
        <p className="section-kicker"><LockKeyhole size={14} /> Your campus space</p>
        <h2>{isRegister ? "Join your campus" : "Welcome back"}</h2>
        <p>{isRegister ? "Create your account, choose how you participate, and contribute to campus life." : "Sign in to continue where campus left off."}</p>
        {resetComplete && <p className="inline-success">Password changed. Sign in with your new password.</p>}
        <form onSubmit={submit}>
          {isRegister && <>
            <label>Your name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} maxLength={80} required placeholder="Your name" /></label>
            <label>Username<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} minLength={3} maxLength={30} required placeholder="e.g. ananya_s" /></label>
            <label>Profession
              <select value={form.profession} onChange={(event) => setForm({ ...form, profession: event.target.value })}>
                <option value="STUDENT">Student</option><option value="TEACHER">Teacher / faculty</option><option value="AUTHORITY">Campus authority</option><option value="ADMINISTRATION">Administration</option><option value="RESIDENT">Resident / community member</option>
              </select>
              <small>Teachers, authorities and administrators receive reports from campuses they join.</small>
            </label>
          </>}
          <label>Campus email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required placeholder="you@campus.edu" /></label>
          <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={isRegister ? 8 : 1} required placeholder={isRegister ? "At least 8 characters" : "Your password"} /></label>
          {error && <p className="inline-error">{error}</p>}
          <button className="button button--red" disabled={pending}>{pending ? "Please wait…" : <>{isRegister ? "Create account" : "Sign in"} <ArrowRight size={17} /></>}</button>
        </form>
        <p className="auth-switch">{isRegister ? "Already part of Bro?" : "New here?"} <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Join your campus"}</Link></p>
      </div>
    </section>
  </main>;
}
