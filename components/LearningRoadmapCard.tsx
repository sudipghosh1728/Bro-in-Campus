"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client-api";
import type { LearningPathCard, LearningProgress } from "@/lib/growth-types";

export function LearningRoadmapCard({ path, index, signedIn, onProgress }: {
  path: LearningPathCard;
  index: number;
  signedIn: boolean;
  onProgress: (id: string, progress: LearningProgress) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const completed = path.progress?.completedMilestones ?? [];

  async function save(ids: string[]) {
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const result = await api<{ progress: LearningProgress }>(`/api/learning-paths/${path.id}/progress`, {
        method: "PUT", body: JSON.stringify({ completedMilestones: ids }),
      });
      onProgress(path.id, result.progress);
      setNotice(result.progress.progress === 100 ? "All milestones completed. Well done!" : "Checklist saved to your account.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save progress. Please try again.");
    } finally { setSaving(false); }
  }

  return <article className="roadmap-card" aria-labelledby={`path-${path.id}`} aria-busy={saving}>
    <div className="roadmap-card__top">
      <span>{String(index + 1).padStart(2, "0")}</span>
      <small>{path.level.replaceAll("_", " ").toLowerCase()} · {path.duration}</small>
      {path.fitScore > 0 && <b>For you</b>}
    </div>
    <h3 id={`path-${path.id}`}>{path.title}</h3>
    <p>{path.description}</p>
    <div className="roadmap-skill-list">{path.skills.map((skill) => <i key={skill}>{skill}</i>)}</div>
    <ol className="roadmap-checklist">
      {path.milestones.map((milestone) => <li key={milestone.id}>
        <label>
          <input type="checkbox" checked={completed.includes(milestone.id)} disabled={!signedIn || saving}
            onChange={() => save(completed.includes(milestone.id) ? completed.filter((id) => id !== milestone.id) : [...completed, milestone.id])} />
          <span><b>{milestone.title}</b><span>{milestone.outcome}</span></span>
        </label>
      </li>)}
    </ol>
    <div className="roadmap-progress">
      {path.progress && <>
        <div><span>{completed.length} / {path.milestones.length} milestones</span><b>{path.progress.progress === 100 && <CheckCircle2 size={14} />} {path.progress.progress}%</b></div>
        <progress value={path.progress.progress} max={100} aria-label={`${path.title} progress`} />
      </>}
      {!signedIn ? <Link className="small-action" href="/login?next=/learn">Sign in to save your progress</Link>
        : !path.progress && <button className="small-action" disabled={saving || !path.milestones.length} onClick={() => save([])}>{saving ? "Saving…" : "Start this pathway"}</button>}
      <small>Self-directed learning · not a certification</small>
      <span className="roadmap-save-status" role="status">{saving ? "Saving checklist…" : notice}</span>
      {error && <p className="inline-error" role="alert">{error}</p>}
    </div>
  </article>;
}
