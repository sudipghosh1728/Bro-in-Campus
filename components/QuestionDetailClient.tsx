"use client";

import Link from "next/link";
import { subscribeToRefresh } from "@/lib/live-refresh";
import { Bookmark, CheckCircle2, Flag, MessageCircle, Pencil, Send, ThumbsUp, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import type { AnswerItem, CommentItem, QuestionDetail, Viewer } from "@/lib/types";
import { Avatar } from "./Avatar";

function CommentThread({ comment, answerId, questionId, user, onChanged }: { comment: CommentItem; answerId?: string; questionId?: string; user: Viewer; onChanged: () => void }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return router.push("/login");
    const url = answerId ? `/api/answers/${answerId}/comments` : `/api/questions/${questionId}/comments`;
    setError("");
    try { await api(url, { method: "POST", body: JSON.stringify({ body: reply, parentId: comment.id }) }); setReply(""); setReplying(false); onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not post reply."); }
  }
  return <div className="comment-thread"><div className="comment"><Avatar name={comment.author.name} src={comment.author.avatarUrl} size="sm" /><div><div><Link href={`/u/${comment.author.username}`}>{comment.author.name}</Link><time> · {new Date(comment.createdAt).toLocaleDateString()}</time></div><p>{comment.body}</p><button onClick={() => setReplying((value) => !value)}>Reply</button></div></div>{comment.replies.map((item) => <div className="comment comment--reply" key={item.id}><Avatar name={item.author.name} src={item.author.avatarUrl} size="sm" /><div><div><Link href={`/u/${item.author.username}`}>{item.author.name}</Link><time> · {new Date(item.createdAt).toLocaleDateString()}</time></div><p>{item.body}</p></div></div>)}{replying && <form className="comment-form comment-form--reply" onSubmit={submit}><input value={reply} onChange={(event) => setReply(event.target.value)} minLength={2} maxLength={2000} placeholder="Write a reply" autoFocus /><button aria-label="Post reply"><Send size={15} /></button></form>}{error && <p className="inline-error">{error}</p>}</div>;
}

function AnswerCard({ answer, question, user, onChanged }: { answer: AnswerItem; question: QuestionDetail; user: Viewer; onChanged: () => void }) {
  const router = useRouter();
  const [upvoted, setUpvoted] = useState(answer.upvoted);
  const [count, setCount] = useState(answer.upvoteCount);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(answer.body);
  const [savingEdit, setSavingEdit] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState("");
  const ownQuestion = user?.id === question.author.id;
  const ownAnswer = user?.id === answer.author.id;

  useEffect(() => { setUpvoted(answer.upvoted); setCount(answer.upvoteCount); }, [answer.upvoted, answer.upvoteCount]);
  useEffect(() => { if (!editing) setDraft(answer.body); }, [answer.body, editing]);

  async function vote() {
    if (!user) return router.push(`/login?next=/questions/${question.slug}`);
    const next = !upvoted; setUpvoted(next); setCount((value) => value + (next ? 1 : -1));
    try { await api(`/api/answers/${answer.id}/upvote`, { method: next ? "POST" : "DELETE" }); }
    catch { setUpvoted(!next); setCount((value) => value + (next ? -1 : 1)); }
  }
  async function accept() {
    if (!user) return router.push("/login");
    setAccepting(true); setMessage("");
    try { await api(`/api/answers/${answer.id}/accept`, { method: "POST" }); onChanged(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not accept this answer."); }
    finally { setAccepting(false); }
  }
  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!user) return router.push("/login");
    setMessage("");
    try { await api(`/api/answers/${answer.id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) }); setComment(""); setShowComment(false); onChanged(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not add comment."); }
  }
  async function saveEdit() {
    setSavingEdit(true); setMessage("");
    try { await api(`/api/answers/${answer.id}`, { method: "PATCH", body: JSON.stringify({ body: draft }) }); setEditing(false); onChanged(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not update answer."); }
    finally { setSavingEdit(false); }
  }
  async function remove() {
    if (!window.confirm("Delete this answer? This cannot be undone from the feed.")) return;
    setRemoving(true); setMessage("");
    try { await api(`/api/answers/${answer.id}`, { method: "DELETE" }); onChanged(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not delete answer."); }
    finally { setRemoving(false); }
  }
  async function report() {
    if (!user) return router.push("/login");
    setMessage("");
    try { await api("/api/reports", { method: "POST", body: JSON.stringify({ answerId: answer.id, reason: "Content requires moderator review." }) }); setMessage("Thanks. This answer has been sent to moderators."); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not submit report."); }
  }

  return <article className={answer.accepted ? "answer-card answer-card--accepted" : "answer-card"}>
    {answer.accepted && <p className="accepted-label"><CheckCircle2 size={15} /> Accepted answer</p>}
    <div className="answer-card__head"><Link href={`/u/${answer.author.username}`}><Avatar name={answer.author.name} src={answer.author.avatarUrl} /></Link><div><Link href={`/u/${answer.author.username}`}>{answer.author.name}</Link><small>{answer.author.college ?? `@${answer.author.username}`} · {new Date(answer.createdAt).toLocaleDateString()}</small></div>{ownQuestion && !answer.accepted && <button className="accept-button" onClick={accept} disabled={accepting}><CheckCircle2 size={16} /> {accepting ? "Accepting…" : "Accept"}</button>}</div>
    {editing ? <div className="answer-editor"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} minLength={20} maxLength={15000} autoFocus /><div><button onClick={() => { setEditing(false); setDraft(answer.body); }}>Cancel</button><button className="save-answer-edit" disabled={savingEdit || draft.trim().length < 20} onClick={saveEdit}>{savingEdit ? "Saving…" : "Save changes"}</button></div></div> : <p className="answer-body">{answer.body}</p>}
    <div className="answer-actions"><button className={upvoted ? "voted" : ""} onClick={vote}><ThumbsUp size={17} fill={upvoted ? "currentColor" : "none"} /> {count}</button><button onClick={() => setShowComment((value) => !value)}><MessageCircle size={17} /> {answer.commentCount}</button>{ownAnswer && <button onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>}{ownAnswer && <button className="danger-action" onClick={remove} disabled={removing}><Trash2 size={13} /> {removing ? "Deleting…" : "Delete"}</button>}<button onClick={report}><Flag size={13} /> Report</button></div>
    {message && <p className={message.startsWith("Thanks") ? "inline-success" : "inline-error"}>{message}</p>}
    {showComment && <form className="comment-form" onSubmit={submitComment}><input value={comment} onChange={(event) => setComment(event.target.value)} minLength={2} maxLength={2000} placeholder="Add a thoughtful comment" autoFocus /><button aria-label="Post comment"><Send size={16} /></button></form>}
    <div className="comment-list">{answer.comments.map((commentItem) => <CommentThread key={commentItem.id} comment={commentItem} answerId={answer.id} user={user} onChanged={onChanged} />)}</div>
  </article>;
}

export function QuestionDetailClient({ initialQuestion, user }: { initialQuestion: QuestionDetail; user: Viewer }) {
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);
  const [body, setBody] = useState("");
  const [comment, setComment] = useState("");
  const [bookmarked, setBookmarked] = useState(initialQuestion.bookmarked);
  const [answering, setAnswering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialQuestion.title);
  const [draftBody, setDraftBody] = useState(initialQuestion.body);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);
  const [message, setMessage] = useState("");
  const ownQuestion = user?.id === question.author.id;
  const refresh = () => router.refresh();

  useEffect(() => { setQuestion(initialQuestion); setBookmarked(initialQuestion.bookmarked); }, [initialQuestion]);
  useEffect(() => { if (!editing) { setDraftTitle(initialQuestion.title); setDraftBody(initialQuestion.body); } }, [initialQuestion.title, initialQuestion.body, editing]);
  useEffect(() => subscribeToRefresh(refresh), [question.id]);
  async function submitAnswer(event: FormEvent) { event.preventDefault(); if (!user) return router.push(`/login?next=/questions/${question.slug}`); setAnswering(true); setMessage(""); try { await api(`/api/questions/${question.id}/answers`, { method: "POST", body: JSON.stringify({ body }) }); setBody(""); refresh(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not post answer."); } finally { setAnswering(false); } }
  async function submitComment(event: FormEvent) { event.preventDefault(); if (!user) return router.push("/login"); setMessage(""); try { await api(`/api/questions/${question.id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) }); setComment(""); refresh(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not add comment."); } }
  async function toggleBookmark() { if (!user) return router.push("/login"); const next = !bookmarked; setBookmarked(next); try { await api(`/api/questions/${question.id}/bookmark`, { method: next ? "POST" : "DELETE" }); } catch (reason) { setBookmarked(!next); setMessage(reason instanceof Error ? reason.message : "Could not update saved item."); } }
  async function saveQuestion() { setSavingQuestion(true); setMessage(""); try { await api(`/api/questions/${question.id}`, { method: "PATCH", body: JSON.stringify({ title: draftTitle, body: draftBody }) }); setEditing(false); refresh(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not update question."); } finally { setSavingQuestion(false); } }
  async function deleteQuestion() { if (!window.confirm("Delete this question and hide it from the community?")) return; setDeletingQuestion(true); setMessage(""); try { await api(`/api/questions/${question.id}`, { method: "DELETE" }); router.push("/discover"); router.refresh(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not delete question."); setDeletingQuestion(false); } }
  async function reportQuestion() { if (!user) return router.push("/login"); setMessage(""); try { await api("/api/reports", { method: "POST", body: JSON.stringify({ questionId: question.id, reason: "Content requires moderator review." }) }); setMessage("Thanks. This question has been sent to moderators."); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not submit report."); } }

  return <main className="platform-page question-page"><div className="question-layout"><section><Link className="back-link" href="/discover">← Back to discussions</Link><article className="question-detail"><div className="question-card__meta"><Link href={`/u/${question.author.username}`}><Avatar name={question.author.name} src={question.author.avatarUrl} size="sm" /></Link><span><Link href={`/u/${question.author.username}`}>{question.author.name}</Link>{question.author.college && <> · {question.author.college}</>}<time> · {new Date(question.createdAt).toLocaleDateString()}</time></span></div>{editing ? <div className="question-editor"><input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} minLength={12} maxLength={220} autoFocus /><textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} minLength={20} maxLength={15000} /><div><button onClick={() => { setEditing(false); setDraftTitle(question.title); setDraftBody(question.body); }}>Cancel</button><button className="save-question-edit" disabled={savingQuestion || draftTitle.trim().length < 12 || draftBody.trim().length < 20} onClick={saveQuestion}>{savingQuestion ? "Saving…" : "Save changes"}</button></div></div> : <><h1>{question.title}</h1><p className="question-detail__body">{question.body}</p><div className="topic-pills">{question.topics.map((topic) => <Link href={`/discover?topic=${topic.slug}`} key={topic.id}>#{topic.name}</Link>)}</div></>}<div className="detail-actions"><button className={bookmarked ? "saved" : ""} onClick={toggleBookmark}><Bookmark size={17} fill={bookmarked ? "currentColor" : "none"} /> {bookmarked ? "Saved" : "Save"}</button>{ownQuestion ? <><button onClick={() => setEditing(true)}><Pencil size={15} /> Edit</button><button className="danger-action" onClick={deleteQuestion} disabled={deletingQuestion}><Trash2 size={15} /> {deletingQuestion ? "Deleting…" : "Delete"}</button></> : <button onClick={reportQuestion}><Flag size={16} /> Report</button>}<span>{question.viewCount} views</span></div>{message && <p className={message.startsWith("Thanks") ? "inline-success" : "inline-error"}>{message}</p>}</article><section className="answers-section" id="answers"><div className="section-title"><h2>{question.answers.length} {question.answers.length === 1 ? "answer" : "answers"}</h2><span>Most useful first</span></div>{question.answers.map((answer) => <AnswerCard key={answer.id} answer={answer} question={question} user={user} onChanged={refresh} />)}<form className="answer-form" onSubmit={submitAnswer}><h2>Your answer</h2><textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={20} maxLength={15000} placeholder="Share what you know. Helpful, specific answers make campus better." />{message && !ownQuestion && <p className="inline-error">{message}</p>}<button className="button button--red" disabled={answering}>{answering ? "Posting…" : "Post answer"}<Send size={16} /></button></form></section><section className="question-comments"><h2>Discussion</h2><form className="comment-form" onSubmit={submitComment}><input value={comment} onChange={(event) => setComment(event.target.value)} minLength={2} maxLength={2000} placeholder="Add to the discussion" /><button aria-label="Post comment"><Send size={16} /></button></form><div className="comment-list">{question.comments.map((commentItem) => <CommentThread key={commentItem.id} comment={commentItem} questionId={question.id} user={user} onChanged={refresh} />)}</div></section></section><aside className="question-aside"><div className="side-card"><p className="section-kicker">Question details</p><dl><div><dt>Asked</dt><dd>{new Date(question.createdAt).toLocaleDateString()}</dd></div><div><dt>Views</dt><dd>{question.viewCount}</dd></div><div><dt>Answers</dt><dd>{question.answers.length}</dd></div></dl></div><div className="side-card"><h2>Answer with care</h2><p>Share your direct experience. Be specific, respectful and useful.</p></div></aside></div></main>;
}
