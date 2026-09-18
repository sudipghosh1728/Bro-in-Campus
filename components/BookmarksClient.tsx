"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useState } from "react";
import { QuestionCard } from "./QuestionCard";
import type { QuestionSummary, Viewer } from "@/lib/types";

export function BookmarksClient({ initialBookmarks, user }: { initialBookmarks: QuestionSummary[]; user: Viewer }) {
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  return <main className="platform-page utility-page">
    <p className="section-kicker"><Bookmark size={14} /> Your reading list</p>
    <div className="utility-heading"><div><h1>Saved discussions</h1><p>Keep the campus conversations you want to come back to.</p></div><span>{bookmarks.length} saved</span></div>
    {bookmarks.length ? <div className="feed-list">{bookmarks.map((question) => <QuestionCard key={question.id} question={question} user={user} onBookmark={(id, bookmarked) => { if (!bookmarked) setBookmarks((items) => items.filter((item) => item.id !== id)); }} />)}</div> : <div className="empty-state utility-empty"><h2>Your list is clear.</h2><p>Save useful discussions from Community to find them here later.</p><Link className="button button--red" href="/discover">Browse discussions</Link></div>}
  </main>;
}
