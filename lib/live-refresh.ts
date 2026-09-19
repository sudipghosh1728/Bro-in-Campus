"use client";

/** Fetch persisted state on any instance; no process-local event bus required. */
export function subscribeToRefresh(refresh: () => void | Promise<unknown>, intervalMs = 30_000) {
  let pending = false;
  let stopped = false;
  const run = async () => {
    if (stopped || pending || document.visibilityState === "hidden" || !navigator.onLine) return;
    pending = true;
    try { await refresh(); } catch { /* Retry on the next tick or reconnect. */ }
    finally { pending = false; }
  };
  const timer = window.setInterval(run, intervalMs);
  document.addEventListener("visibilitychange", run);
  window.addEventListener("online", run);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", run);
    window.removeEventListener("online", run);
  };
}
