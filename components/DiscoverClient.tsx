"use client";

import Link from "next/link";
import { ArrowRight, Filter, Search, Sparkles, UserPlus } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import type { DiscoverData, PersonSummary, TopicSummary, Viewer } from "@/lib/types";
import { Avatar } from "./Avatar";
import { QuestionCard } from "./QuestionCard";

type InitialFilters = { sort: "latest" | "trending" | "recommended"; query: string; topic: string | null; focusSearch: boolean };

export function DiscoverClient({ initialData, user, initialFilters }: { initialData: DiscoverData; user: Viewer; initialFilters: InitialFilters }) {
  const [data, setData] = useState(initialData);
  const [sort, setSort] = useState<"latest" | "trending" | "recommended">(initialFilters.sort);
  const [query, setQuery] = useState(initialFilters.query);
  const [activeTopic, setActiveTopic] = useState<string | null>(initialFilters.topic);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (append = false, cursor?: string | null, overrides?: Partial<Pick<InitialFilters, "sort" | "query" | "topic">>) => {
    setLoading(true); setMessage("");
    const selectedSort = overrides?.sort ?? sort;
    const selectedQuery = overrides?.query ?? query;
    const selectedTopic = overrides?.topic ?? activeTopic;
    const params = new URLSearchParams({ sort: selectedSort, take: "20" });
    if (selectedQuery) params.set("q", selectedQuery);
    if (selectedTopic) params.set("topic", selectedTopic);
    if (cursor) params.set("cursor", cursor);
    try {
      const next = await api<DiscoverData>(`/api/questions?${params}`);
      setData((current) => append ? { ...next, questions: [...current.questions, ...next.questions] } : next);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not load discussions."); }
    finally { setLoading(false); }
  }, [activeTopic, query, sort]);

  useEffect(() => {
    const stream = new EventSource("/api/realtime");
    const refresh = () => load(false);
    ["QUESTION_CREATED", "QUESTION_LIKED", "QUESTION_UNLIKED", "ANSWER_CREATED", "ANSWER_UPDATED", "ANSWER_DELETED", "UPVOTE_CREATED", "UPVOTE_REMOVED", "COMMENT_CREATED"].forEach((event) => stream.addEventListener(event, refresh));
    return () => stream.close();
  }, [load]);

  useEffect(() => { if (initialFilters.focusSearch) searchInput.current?.focus(); }, [initialFilters.focusSearch]);

  function submit(event: FormEvent) { event.preventDefault(); load(false); }
  function updateTopic(topic: string | null) { setActiveTopic(topic); load(false, undefined, { topic }); }

  async function followTopic(topic: TopicSummary) {
    if (!user) return setMessage("Sign in to follow a topic.");
    const following = !topic.following;
    setData((current) => ({ ...current, topics: current.topics.map((item) => item.id === topic.id ? { ...item, following, followerCount: item.followerCount + (following ? 1 : -1) } : item) }));
    try { await api(`/api/topics/${topic.id}/follow`, { method: following ? "POST" : "DELETE" }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not update topic."); load(false); }
  }

  async function followUser(person: PersonSummary) {
    if (!user) return setMessage("Sign in to follow students.");
    const following = !person.following;
    setData((current) => ({ ...current, recommendedUsers: current.recommendedUsers.map((item) => item.id === person.id ? { ...item, following, followerCount: (item.followerCount ?? 0) + (following ? 1 : -1) } : item) }));
    try { await api(`/api/users/${person.id}/follow`, { method: following ? "POST" : "DELETE" }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not follow user."); load(false); }
  }

  return <main className="platform-page discover-page">
    <section className="discover-hero"><div><p className="section-kicker"><Sparkles size={14} /> Campus conversations, made useful</p><h1>What&apos;s happening<br /><em>on campus?</em></h1><p>Ask questions, trade honest answers, and stay in the loop with people who understand your college life.</p></div><Link className="button button--red" href={user ? "/ask" : "/register"}>Ask a question <ArrowRight size={17} /></Link></section>
    <section className="discover-layout"><aside className="discover-sidebar"><div className="side-card" id="topics"><div className="side-card__title"><h2>Topics</h2><Filter size={15} /></div><button className={!activeTopic ? "topic-row selected" : "topic-row"} onClick={() => updateTopic(null)}>All discussions <span>{data.questions.length}</span></button>{data.topics.map((topic) => <div className="topic-row-wrap" key={topic.id}><button className={activeTopic === topic.slug ? "topic-row selected" : "topic-row"} onClick={() => updateTopic(topic.slug)}>#{topic.name}<span>{topic.questionCount}</span></button><button className={topic.following ? "tiny-follow following" : "tiny-follow"} onClick={() => followTopic(topic)}>{topic.following ? "Following" : "Follow"}</button></div>)}</div><div className="side-card side-card--people"><div className="side-card__title"><h2>People to know</h2><UserPlus size={15} /></div>{data.recommendedUsers.map((person) => <div className="person-row" key={person.id}><Link href={`/u/${person.username}`}><Avatar name={person.name} src={person.avatarUrl} size="sm" /></Link><Link href={`/u/${person.username}`}><b>{person.name}</b><small>{person.college ?? `@${person.username}`}</small></Link><button className={person.following ? "person-follow following" : "person-follow"} onClick={() => followUser(person)}>{person.following ? "✓" : "+"}</button></div>)}</div></aside>
      <div className="feed-column"><form className="discover-search" onSubmit={submit}><Search size={18} /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions, topics and people" /><button type="submit">Search</button></form><div className="feed-controls"><div>{(["recommended", "latest", "trending"] as const).map((value) => <button key={value} className={sort === value ? "selected" : ""} onClick={() => { setSort(value); load(false, undefined, { sort: value }); }}>{value}</button>)}</div><span>{loading ? "Updating…" : `${data.questions.length} discussions`}</span></div>{message && <p className="inline-error">{message}</p>}<div className="feed-list">{data.questions.length ? data.questions.map((question) => <QuestionCard key={question.id} question={question} user={user} onBookmark={(id, bookmarked) => setData((current) => ({ ...current, questions: current.questions.map((item) => item.id === id ? { ...item, bookmarked } : item) }))} />) : <div className="empty-state"><h2>No discussions yet.</h2><p>Be the first person to ask a useful campus question.</p><Link href={user ? "/ask" : "/register"} className="button button--red">Ask a question</Link></div>}</div>{data.nextCursor && <button className="load-more" disabled={loading} onClick={() => load(true, data.nextCursor)}>{loading ? "Loading…" : "Load more discussions"}</button>}</div>
    </section>
  </main>;
}
