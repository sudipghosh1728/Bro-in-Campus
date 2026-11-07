"use client";

import Link from "next/link";
import { subscribeToRefresh } from "@/lib/live-refresh";
import { ArrowDown, ArrowUpRight, Bookmark, BookOpen, BriefcaseBusiness, CalendarDays, ChevronLeft, Hash, Info, MapPin, MessageCircle, Plus, Search, Send, UsersRound, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import type { DiscoverData, PersonSummary, TopicSummary, Viewer } from "@/lib/types";
import { Avatar } from "./Avatar";
import { QuestionCard } from "./QuestionCard";

type InitialFilters = { sort: "latest" | "trending" | "recommended"; query: string; topic: string | null; focusSearch: boolean };

export function DiscoverClient({ initialData, user, initialFilters }: { initialData: DiscoverData; user: Viewer; initialFilters: InitialFilters }) {
  const [data, setData] = useState(initialData);
  const [sort, setSort] = useState(initialFilters.sort);
  const [query, setQuery] = useState(initialFilters.query);
  const [draftQuery, setDraftQuery] = useState(initialFilters.query);
  const [activeTopic, setActiveTopic] = useState(initialFilters.topic);
  const [channelQuery, setChannelQuery] = useState("");
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const thread = useRef<HTMLDivElement>(null);

  const load = useCallback(async (append = false, cursor?: string | null, overrides?: Partial<Pick<InitialFilters, "sort" | "query" | "topic">>) => {
    const id = ++requestId.current;
    setLoading(true); setMessage("");
    const selectedSort = overrides?.sort ?? sort;
    const selectedQuery = overrides?.query ?? query;
    // An explicit null means "all channels"; it must not fall back to the old one.
    const selectedTopic = overrides && "topic" in overrides ? overrides.topic : activeTopic;
    const params = new URLSearchParams({ sort: selectedSort, take: "20" });
    const feedOnly = append || Boolean(overrides);
    if (feedOnly) params.set("sidebar", "0");
    if (selectedQuery) params.set("q", selectedQuery);
    if (selectedTopic) params.set("topic", selectedTopic);
    if (cursor) params.set("cursor", cursor);
    try {
      const next = await api<DiscoverData>(`/api/questions?${params}`);
      if (id !== requestId.current) return;
      setData((current) => ({
        ...next,
        ...(feedOnly ? { topics: current.topics, recommendedUsers: current.recommendedUsers } : {}),
        questions: append ? [...current.questions, ...next.questions.filter((question) => !current.questions.some((existing) => existing.id === question.id))] : next.questions,
      }));
    } catch (error) {
      if (id === requestId.current) setMessage(error instanceof Error ? error.message : "Could not load discussions.");
    } finally { if (id === requestId.current) setLoading(false); }
  }, [activeTopic, query, sort]);

  useEffect(() => subscribeToRefresh(() => load(false)), [load]);
  useEffect(() => { if (initialFilters.focusSearch) searchInput.current?.focus(); }, [initialFilters.focusSearch]);

  function submit(event: FormEvent) { event.preventDefault(); setQuery(draftQuery); load(false, undefined, { query: draftQuery }); }
  function updateTopic(topic: string | null) {
    setActiveTopic(topic); setChannelsOpen(false);
    load(false, undefined, { topic });
    thread.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  async function followTopic(topic: TopicSummary) {
    if (!user) { setMessage("Sign in to follow a channel."); return; }
    try {
      await api(`/api/topics/${topic.id}/follow`, { method: topic.following ? "DELETE" : "POST" });
      setData((current) => ({ ...current, topics: current.topics.map((item) => item.id === topic.id ? { ...item, following: !topic.following, followerCount: Math.max(0, item.followerCount + (topic.following ? -1 : 1)) } : item) }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not follow the channel."); }
  }

  async function followUser(person: PersonSummary) {
    if (!user) { setMessage("Sign in to follow students."); return; }
    try {
      await api(`/api/users/${person.id}/follow`, { method: person.following ? "DELETE" : "POST" });
      setData((current) => ({ ...current, recommendedUsers: current.recommendedUsers.map((item) => item.id === person.id ? { ...item, following: !person.following } : item) }));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not follow this student."); }
  }

  const selectedChannel = data.topics.find((topic) => topic.slug === activeTopic);
  const title = selectedChannel?.name ?? "Campus commons";
  const askUrl = user ? "/ask" : "/login?next=/ask";

  return <main className="community-page">
    <div className="community-caption"><span><i /> YOUR CAMPUS, IN CONVERSATION</span><Link href="/colleges">Find your campus <ArrowUpRight size={13} /></Link></div>
    <div className="community-workspace">
      <nav className="community-rail" aria-label="Student workspace">
        <Link href="/community" className="active" aria-label="Community conversations" title="Community"><MessageCircle size={23} /></Link>
        <Link href="/colleges" aria-label="Your campuses" title="Campuses"><UsersRound size={22} /></Link>
        <Link href="/campus" aria-label="Campus events" title="Events"><CalendarDays size={22} /></Link>
        <Link href="/careers" aria-label="Career opportunities" title="Careers"><BriefcaseBusiness size={22} /></Link>
        <Link href="/learn" aria-label="Learning pathways" title="Learn"><BookOpen size={22} /></Link>
        <span />
        <Link href={user ? "/bookmarks" : "/login?next=/bookmarks"} aria-label="Saved discussions" title="Saved"><Bookmark size={21} /></Link>
        <Link href={user ? "/settings/profile" : "/login"} aria-label={user ? "Your profile" : "Sign in"}>{user ? <Avatar name={user.name} src={user.avatarUrl ?? null} size="sm" /> : <Plus size={21} />}</Link>
      </nav>

      <aside className={channelsOpen ? "community-channels community-channels--open" : "community-channels"} aria-label="Discussion channels">
        <div className="community-channels-heading"><div><p>YOUR EVERYDAY SPACE</p><h1>Conversations<span>.</span></h1></div><button className="community-close-channels" aria-label="Close channels" onClick={() => setChannelsOpen(false)}><X size={20} /></button></div>
        <label className="community-channel-search"><Search size={17} /><input value={channelQuery} onChange={(event) => setChannelQuery(event.target.value)} placeholder="Find a channel" aria-label="Find a channel" /></label>
        <div className="community-channel-list">
          <button className={!activeTopic ? "community-channel active" : "community-channel"} aria-pressed={!activeTopic} onClick={() => updateTopic(null)}><span className="community-channel-icon"><MessageCircle size={22} /></span><span><b>Campus commons</b><small>A little of everything. All of us.</small></span></button>
          <div className="community-list-label">TOPIC CHANNELS <span>{data.topics.length}</span></div>
          {data.topics.filter((topic) => topic.name.toLowerCase().includes(channelQuery.toLowerCase())).map((topic, index) => <button key={topic.id} className={activeTopic === topic.slug ? "community-channel active" : "community-channel"} aria-pressed={activeTopic === topic.slug} onClick={() => updateTopic(topic.slug)}><span className={`community-channel-icon community-channel-icon--${index % 4}`}><Hash size={23} /></span><span><b>{topic.name}</b><small>{topic.questionCount} discussions · {topic.following ? "Following" : "Open channel"}</small></span>{topic.following && <span className="community-follow-dot" aria-label="Following" />}</button>)}
          {channelQuery && !data.topics.some((topic) => topic.name.toLowerCase().includes(channelQuery.toLowerCase())) && <p className="community-no-channels">No channel matches that name.</p>}
        </div>
        <Link className="community-campus-shortcut" href="/colleges"><span><MapPin size={19} /></span><div><b>Your campus has a voice.</b><small>Review locations & placements</small></div><ArrowUpRight size={16} /></Link>
      </aside>

      <section className="community-conversation" aria-label={title}>
        <header className="community-conversation-heading"><button className="community-open-channels" onClick={() => setChannelsOpen(true)} aria-label="Open channels" aria-expanded={channelsOpen}><ChevronLeft size={23} /></button><span className="community-room-icon">{selectedChannel ? <Hash size={24} /> : <MessageCircle size={24} />}</span><div><h2>{title}</h2><p>{selectedChannel ? `${selectedChannel.followerCount} following · Public discussion channel` : "Public conversations. Useful connections."}</p></div>{selectedChannel && <button className="community-follow-channel" onClick={() => followTopic(selectedChannel)}>{selectedChannel.following ? "Following" : "Follow"}</button>}<a href="#community-about" className="community-info-link" aria-label="About this space"><Info size={20} /></a></header>
        <form className="community-feed-search" onSubmit={submit}><Search size={17} /><input ref={searchInput} aria-label="Search discussions" placeholder={`Search in ${title.toLowerCase()}…`} value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} /><button type="submit" disabled={loading}>Search</button></form>
        <div className="community-sort"><div role="group" aria-label="Sort discussions">{(["recommended", "latest", "trending"] as const).map((value) => <button key={value} aria-pressed={sort === value} onClick={() => { setSort(value); load(false, undefined, { sort: value }); }}>{value === "recommended" ? "For you" : value === "latest" ? "Latest" : "Trending"}</button>)}</div><span role="status">{loading ? "Refreshing…" : `${data.questions.length} discussions loaded`}</span></div>
        <div className="community-thread" ref={thread} aria-busy={loading}>
          <div className="community-thread-marker">THE CONVERSATION STARTS WITH YOU</div>
          {message && <p className="community-error" role="alert">{message}</p>}
          {data.questions.length ? data.questions.map((question) => <div key={question.id} className={question.author.id === user?.id ? "community-message community-message--mine" : "community-message"}><QuestionCard question={question} user={user} onBookmark={(id, bookmarked) => setData((current) => ({ ...current, questions: current.questions.map((item) => item.id === id ? { ...item, bookmarked } : item) }))} /></div>) : <div className="community-empty"><MessageCircle size={44} /><h3>{query ? "Nothing here just yet." : "Someone has the same question."}</h3><p>{query ? "Try a different search or channel." : "A project idea. A placement question. That thing nobody explained in class. Start a conversation."}</p><Link href={askUrl}>Start a discussion <ArrowUpRight size={16} /></Link></div>}
          {data.nextCursor && <button className="community-load-more" disabled={loading} onClick={() => load(true, data.nextCursor)}><ArrowDown size={15} /> {loading ? "Loading…" : "More conversations"}</button>}
        </div>
        <footer className="community-composer"><Link className="community-compose-link" href={askUrl}><Plus size={21} /><span>Ask something. Share a little knowledge.</span><span className="community-send"><Send size={19} /></span></Link><small>Public discussion · Your profile is visible on posts · Anonymous reports live on your campus board</small></footer>
      </section>

      <aside className="community-context" id="community-about">
        <div className="community-context-art" aria-hidden="true"><span /><span /><MessageCircle size={33} /></div>
        <p className="community-eyebrow">BETWEEN LECTURES</p><h2>Good company.<br /><em>Better questions.</em></h2>
        <p>A space for the things that make student life a little easier.</p>
        <div className="community-context-links"><Link href="/learn"><BookOpen size={16} /> Build your next skill <ArrowUpRight size={14} /></Link><Link href="/careers"><BriefcaseBusiness size={16} /> Find your next move <ArrowUpRight size={14} /></Link><Link href="/campus"><CalendarDays size={16} /> What’s on campus <ArrowUpRight size={14} /></Link></div>
        <div className="community-people-title"><h3>Meet your people</h3><Link href="/students" aria-label="Browse students"><ArrowUpRight size={16} /></Link></div>
        {data.recommendedUsers.slice(0, 4).map((person) => <div className="community-person" key={person.id}><Link href={`/u/${person.username}`}><Avatar name={person.name} src={person.avatarUrl} size="sm" /></Link><Link href={`/u/${person.username}`}><b>{person.name}</b><small>{person.college || `@${person.username}`}</small></Link><button aria-label={`${person.following ? "Unfollow" : "Follow"} ${person.name}`} onClick={() => followUser(person)}>{person.following ? "✓" : "+"}</button></div>)}
        {!data.recommendedUsers.length && <p>More people will appear as the community grows.</p>}
        <div className="community-house-note"><Info size={16} /><p>Keep it helpful. Protect personal information. Community votes reflect member views—not official verification.</p></div>
      </aside>
    </div>
  </main>;
}
