"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";

export function ImpersonationBanner({ adminName, targetName }: { adminName: string; targetName: string }) {
  const [error, setError] = useState("");
  const [stopping, setStopping] = useState(false);

  async function stop() {
    setStopping(true);
    setError("");
    try {
      await api("/api/admin/impersonation/stop", { method: "POST" });
      window.location.assign("/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not end impersonation.");
      setStopping(false);
    }
  }

  return <aside className="impersonation-banner" role="status">
    <span>Support mode: viewing as <b>{targetName}</b>. Admin: {adminName}.</span>
    {error && <span className="impersonation-banner__error">{error}</span>}
    <button disabled={stopping} onClick={stop}>{stopping ? "Returning…" : "Stop impersonating"}</button>
  </aside>;
}
