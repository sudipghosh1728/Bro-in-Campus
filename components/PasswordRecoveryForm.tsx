"use client";

import Link from "next/link";
import { ArrowRight, KeyRound, MailCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client-api";

export function PasswordRecoveryForm({ step }: { step: "request" | "reset" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isRequest = step === "request";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!isRequest && password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }
    setPending(true);
    try {
      if (isRequest) {
        await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
        setMessage("If that email belongs to an active account, a 6-digit code is on its way.");
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
      } else {
        await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ email, code, password }) });
        router.push("/login?reset=1");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not continue.");
    } finally {
      setPending(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-promise password-promise">
      <p className="section-kicker">Account recovery</p>
      <h1>{isRequest ? <>Get back to<br /><em>your campus.</em></> : <>Set a new<br /><em>password.</em></>}</h1>
      <p>{isRequest ? "We will send a short-lived verification code to your campus email." : "Enter the six-digit code from Gmail, then choose a new password."}</p>
    </section>
    <section className="auth-panel">
      <div className="auth-form-wrap password-recovery-form">
        <p className="section-kicker">{isRequest ? <><MailCheck size={14} /> Gmail OTP</> : <><KeyRound size={14} /> Verify your code</>}</p>
        <h2>{isRequest ? "Forgot your password?" : "Check your inbox"}</h2>
        <p>{isRequest ? "Enter your account email and we will email a one-time code that expires in 10 minutes." : "The code can be used once. Request another code if it has expired."}</p>
        <form onSubmit={submit}>
          <label>Campus email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@campus.edu" autoComplete="email" /></label>
          {!isRequest && <>
            <label>6-digit code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" placeholder="123456" /></label>
            <label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="At least 8 characters" /></label>
            <label>Confirm new password<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Repeat your new password" /></label>
          </>}
          {message && <p className="inline-success">{message}</p>}
          {error && <p className="inline-error">{error}</p>}
          <button className="button button--red" disabled={pending}>{pending ? "Please wait…" : <>{isRequest ? "Email my code" : "Change password"} <ArrowRight size={17} /></>}</button>
        </form>
        {isRequest ? <p className="auth-switch">Remembered it? <Link href="/login">Back to sign in</Link></p> : <p className="auth-switch"><Link href="/forgot-password">Send a new code</Link> · <Link href="/login">Back to sign in</Link></p>}
      </div>
    </section>
  </main>;
}
