"use client";

import { ArrowRight, Check, Tag } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";

type Topic = { id: string; name: string; slug: string; description: string | null };

export function AskQuestionClient({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  function toggle(topicId: string) { setTopicIds((current) => current.includes(topicId) ? current.filter((id) => id !== topicId) : current.length === 5 ? current : [...current, topicId]); }
  async function submit(event: FormEvent) { event.preventDefault(); setSending(true); setError(""); try { const question = await api<{ slug: string }>("/api/questions", { method: "POST", body: JSON.stringify({ title, body, topicIds }) }); router.push(`/questions/${question.slug}`); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not post your question."); } finally { setSending(false); } }
  return <main className="app-page composer-page"><section className="composer-intro"><p className="section-kicker">Share a useful question</p><h1>Start a conversation<br /><em>worth having.</em></h1><p>The clearest questions get the most useful answers. Add context, then choose the topics that make it discoverable.</p></section><form className="question-composer" onSubmit={submit}><label>What do you want to know?<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={12} maxLength={220} required placeholder="e.g. What is the best way to prepare for our final placement round?" /><small>{title.length}/220</small></label><label>Give people the context<textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={20} maxLength={15000} required placeholder="Mention your course, semester or what you have tried so far. The more context you give, the more useful the answers become." /><small>{body.length}/15,000</small></label><fieldset><legend><Tag size={15} /> Add up to five topics</legend><div className="topic-selector">{topics.map((topic) => <button type="button" key={topic.id} className={topicIds.includes(topic.id) ? "selected" : ""} onClick={() => toggle(topic.id)}><span>{topicIds.includes(topic.id) && <Check size={13} />}</span>#{topic.name}</button>)}</div></fieldset>{error && <p className="inline-error">{error}</p>}<div className="composer-actions"><button className="button button--red" disabled={sending}>{sending ? "Posting…" : <>Post question <ArrowRight size={17} /></>}</button><small>Be respectful, specific, and never share someone else&apos;s private information.</small></div></form></main>;
}
