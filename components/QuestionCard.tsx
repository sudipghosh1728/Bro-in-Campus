"use client";

import Link from "next/link";
import { Bookmark, Eye, MessageCircle, Share2, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { QuestionSummary, Viewer } from "@/lib/types";
import { Avatar } from "./Avatar";

export function QuestionCard({ question, user, onBookmark }: { question: QuestionSummary; user: Viewer; onBookmark?: (id: string, bookmarked: boolean) => void }) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(question.bookmarked);
  const [liked, setLiked] = useState(question.liked);
  const [likeCount, setLikeCount] = useState(question.upvoteCount);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function bookmark() {
    if (!user) return router.push(`/login?next=/questions/${question.slug}`);
    if (busy) return;
    const next = !bookmarked;
    setBookmarked(next);
    setBusy(true);
    try {
      await api(`/api/questions/${question.id}/bookmark`, { method: next ? "POST" : "DELETE" });
      onBookmark?.(question.id, next);
    } catch {
      setBookmarked(!next);
    } finally { setBusy(false); }
  }

  async function share() {
    const url = `${window.location.origin}/questions/${question.slug}`;
    if (navigator.share) await navigator.share({ title: question.title, url }).catch(() => undefined);
    else await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function like() {
    if (!user) return router.push(`/login?next=/questions/${question.slug}`);
    if (busy) return;
    const next = !liked;
    setLiked(next); setLikeCount((count) => Math.max(0, count + (next ? 1 : -1))); setBusy(true);
    try {
      const result = await api<{ liked: boolean; likeCount: number }>(`/api/questions/${question.id}/like`, { method: next ? "POST" : "DELETE" });
      setLiked(result.liked); setLikeCount(result.likeCount);
    } catch { setLiked(!next); setLikeCount((count) => Math.max(0, count + (next ? -1 : 1))); }
    finally { setBusy(false); }
  }

  return <article className="question-card">
    <div className="question-card__meta"><Link href={`/u/${question.author.username}`}><Avatar name={question.author.name} src={question.author.avatarUrl} size="sm" /></Link><span><Link href={`/u/${question.author.username}`}>{question.author.name}</Link>{question.author.college && <> · {question.author.college}</>}<time dateTime={question.createdAt}> · {new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round((new Date(question.createdAt).getTime() - Date.now()) / 3_600_000), "hour")}</time></span></div>
    <Link href={`/questions/${question.slug}`} className="question-card__body"><h2>{question.title}</h2><p>{question.body}</p></Link>
    <div className="topic-pills">{question.topics.map((topic) => <Link href={`/discover?topic=${topic.slug}`} key={topic.id}>#{topic.name}</Link>)}</div>
    <div className="question-card__footer"><div><Link href={`/questions/${question.slug}#answers`}><MessageCircle size={16} />{question.answerCount} {question.answerCount === 1 ? "answer" : "answers"}</Link><button className={liked ? "question-like liked" : "question-like"} onClick={like} disabled={busy} aria-label={liked ? "Remove like" : "Like question"}><ThumbsUp size={16} fill={liked ? "currentColor" : "none"} />{likeCount}</button><span><Eye size={16} />{question.viewCount}</span></div><div><button onClick={share} aria-label="Share question"><Share2 size={16} />{copied && <i>Copied</i>}</button><button className={bookmarked ? "saved" : ""} onClick={bookmark} disabled={busy} aria-label="Bookmark question"><Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} /></button></div></div>
  </article>;
}
