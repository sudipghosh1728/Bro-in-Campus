export type Viewer = { id: string; name: string; username: string; role: "USER" | "MODERATOR" | "ADMIN"; avatarUrl?: string | null; profession?: string | null } | null;

export type TopicSummary = { id: string; name: string; slug: string; description: string | null; questionCount: number; followerCount: number; following: boolean };
export type PersonSummary = { id: string; name: string; username: string; avatarUrl: string | null; college: string | null; followerCount?: number; following: boolean };
export type QuestionSummary = {
  id: string; title: string; slug: string; body: string; viewCount: number; createdAt: string; updatedAt: string; answerCount: number; commentCount: number; bookmarkCount: number; upvoteCount: number; liked: boolean; bookmarked: boolean; score?: number;
  author: { id: string; name: string; username: string; avatarUrl: string | null; college: string | null };
  topics: { id: string; name: string; slug: string }[];
};
export type DiscoverData = { questions: QuestionSummary[]; nextCursor: string | null; topics: TopicSummary[]; recommendedUsers: PersonSummary[] };
export type CommentItem = { id: string; body: string; createdAt: string; author: { id: string; name: string; username: string; avatarUrl: string | null }; replies: Omit<CommentItem, "replies">[] };
export type AnswerItem = { id: string; body: string; accepted: boolean; createdAt: string; updatedAt: string; upvoteCount: number; commentCount: number; upvoted: boolean; author: { id: string; name: string; username: string; avatarUrl: string | null; college: string | null }; comments: CommentItem[] };
export type QuestionDetail = { id: string; title: string; slug: string; body: string; viewCount: number; createdAt: string; updatedAt: string; bookmarked: boolean; author: { id: string; name: string; username: string; avatarUrl: string | null; college: string | null; campus: string | null }; topics: { id: string; name: string; slug: string }[]; comments: CommentItem[]; answers: AnswerItem[] };
export type NotificationItem = { id: string; type: string; entityId: string | null; message: string; readAt: string | null; createdAt: string; actor: { id: string; name: string; username: string; avatarUrl: string | null } | null };
