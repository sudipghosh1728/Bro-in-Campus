"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpenText, MessageSquareText, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/client-api";
import type { QuestionSummary, Viewer } from "@/lib/types";
import { Avatar } from "./Avatar";
import { QuestionCard } from "./QuestionCard";

type PublicProfile = { id: string; name: string; username: string; avatarUrl: string | null; bio: string | null; college: string | null; campus: string | null; course: string | null; interests: string[]; questionCount: number; answerCount: number; followerCount: number; followingCount: number; following: boolean; questions: QuestionSummary[] };

export function UserProfileClient({ profile, user }: { profile: PublicProfile; user: Viewer }) {
  const [following, setFollowing] = useState(profile.following);
  const [followers, setFollowers] = useState(profile.followerCount);
  const [message, setMessage] = useState("");
  const ownProfile = user?.id === profile.id;
  async function follow() {
    if (!user) { window.location.assign(`/login?next=/u/${profile.username}`); return; }
    const next = !following; setFollowing(next); setFollowers((value) => value + (next ? 1 : -1));
    try { await api(`/api/users/${profile.id}/follow`, { method: next ? "POST" : "DELETE" }); }
    catch (error) { setFollowing(!next); setFollowers((value) => value + (next ? -1 : 1)); setMessage(error instanceof Error ? error.message : "Could not update follow status."); }
  }
  return <main className="platform-page profile-page"><section className="profile-hero"><Avatar name={profile.name} src={profile.avatarUrl} size="lg" /><div className="profile-hero__copy"><p className="section-kicker">Campus member</p><h1>{profile.name}</h1><p className="profile-handle">@{profile.username}</p>{profile.bio && <p className="profile-bio">{profile.bio}</p>}{(profile.college || profile.course || profile.campus) && <p className="profile-meta">{[profile.course, profile.college, profile.campus].filter(Boolean).join(" · ")}</p>}{profile.interests.length > 0 && <div className="interest-pills">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>}</div><div className="profile-hero__actions">{ownProfile ? <Link className="button button--dark" href="/settings/profile">Edit profile</Link> : <button className={following ? "button button--light" : "button button--red"} onClick={follow}><UserPlus size={16} /> {following ? "Following" : "Follow"}</button>}{message && <p className="inline-error">{message}</p>}</div></section><section className="profile-stats"><span><Users size={17} /><b>{followers}</b> followers</span><span><Users size={17} /><b>{profile.followingCount}</b> following</span><span><BookOpenText size={17} /><b>{profile.questionCount}</b> questions</span><span><MessageSquareText size={17} /><b>{profile.answerCount}</b> answers</span></section><section className="profile-questions"><div className="section-title"><h2>{ownProfile ? "Your discussions" : `${profile.name.split(" ")[0]}’s discussions`}</h2></div>{profile.questions.length ? <div className="feed-list">{profile.questions.map((question) => <QuestionCard key={question.id} question={question} user={user} />)}</div> : <div className="empty-state"><h2>No questions yet.</h2><p>{ownProfile ? "Start a useful campus discussion when you are ready." : "This member has not started a discussion yet."}</p>{ownProfile && <Link className="button button--red" href="/ask">Ask a question</Link>}</div>}</section></main>;
}
