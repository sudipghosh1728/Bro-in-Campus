import { Prisma } from "@prisma/client";
import { ApiError } from "./api";
import { prisma } from "./prisma";
import { publishPublic, publishUser } from "./realtime";
import { uniqueQuestionSlug } from "./slug";
import type { CurrentUser } from "./auth";
import { ContentStatus, NotificationType, Role } from "./domain";

type Viewer = Pick<CurrentUser, "id" | "role"> | null;
type QuestionCardRecord = {
  id: string; title: string; slug: string; body: string; viewCount: number; createdAt: Date; updatedAt: Date;
  author: { id: string; name: string; username: string; profile: { avatarUrl: string | null; college: string | null } | null };
  topics: { topic: { id: string; name: string; slug: string } }[];
  answers: { _count: { votes: number } }[];
  _count: { answers: number; bookmarks: number; comments: number; votes: number };
  bookmarks: { userId: string }[];
  votes: { userId: string }[];
};

// MongoDB distinguishes an absent optional field from a field explicitly set
// to null. Prisma omits optional fields on create, so both states are active.
const publicQuestionWhere: Prisma.QuestionWhereInput = { status: ContentStatus.PUBLISHED, OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] };
const publicAnswerWhere: Prisma.AnswerWhereInput = { status: ContentStatus.PUBLISHED, OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] };
const publicCommentWhere: Prisma.CommentWhereInput = { status: ContentStatus.PUBLISHED, OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] };
const rootCommentWhere: Prisma.CommentWhereInput = { AND: [publicCommentWhere, { OR: [{ parentId: null }, { parentId: { isSet: false } }] }] };

const cardInclude = (viewerId?: string): Prisma.QuestionInclude => ({
  author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true, college: true } } } },
  topics: { include: { topic: { select: { id: true, name: true, slug: true } } } },
  answers: { where: publicAnswerWhere, select: { _count: { select: { votes: true } } } },
  _count: { select: { answers: true, bookmarks: true, comments: true, votes: true } },
  bookmarks: viewerId ? { where: { userId: viewerId }, select: { userId: true } } : { take: 0, select: { userId: true } },
  votes: viewerId ? { where: { userId: viewerId }, select: { userId: true } } : { take: 0, select: { userId: true } },
});

function questionCard(record: QuestionCardRecord, score?: number) {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    body: record.body,
    viewCount: record.viewCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    answerCount: record._count.answers,
    commentCount: record._count.comments,
    bookmarkCount: record._count.bookmarks,
    upvoteCount: record._count.votes,
    liked: record.votes.length > 0,
    bookmarked: record.bookmarks.length > 0,
    score,
    author: { ...record.author, avatarUrl: record.author.profile?.avatarUrl ?? null, college: record.author.profile?.college ?? null },
    topics: record.topics.map(({ topic }) => topic),
  };
}

export type DiscoverFilters = { q?: string; topic?: string; sort?: "latest" | "trending" | "recommended"; cursor?: string; take?: number };

export async function getDiscoverFeed(viewer: Viewer, filters: DiscoverFilters = {}) {
  const take = Math.min(filters.take ?? 20, 50);
  const conditions: Prisma.QuestionWhereInput[] = [publicQuestionWhere];
  if (filters.topic) conditions.push({ topics: { some: { topic: { slug: filters.topic } } } });
  if (filters.q) conditions.push({
      OR: [
        { title: { contains: filters.q, mode: "insensitive" } },
        { body: { contains: filters.q, mode: "insensitive" } },
        { topics: { some: { topic: { name: { contains: filters.q, mode: "insensitive" } } } } },
      ],
    });
  const where: Prisma.QuestionWhereInput = { AND: conditions };

  const [questions, topics, recommendedUsers] = await Promise.all([
    prisma.question.findMany({
      where,
      take: filters.sort === "recommended" ? 100 : take + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      orderBy: filters.sort === "trending" ? { viewCount: "desc" } : { createdAt: "desc" },
      include: cardInclude(viewer?.id),
    }),
    prisma.topic.findMany({ orderBy: { followers: { _count: "desc" } }, take: 12, include: { _count: { select: { followers: true, questions: true } }, followers: viewer ? { where: { userId: viewer.id }, select: { userId: true } } : { take: 0, select: { userId: true } } } }),
    prisma.user.findMany({
      where: { isSuspended: false, ...(viewer ? { id: { not: viewer.id } } : {}) },
      orderBy: { questions: { _count: "desc" } },
      take: 5,
      select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true, college: true } }, _count: { select: { followedBy: true } }, followedBy: viewer ? { where: { followerId: viewer.id }, select: { followerId: true } } : { take: 0, select: { followerId: true } } },
    }),
  ]);

  let followingTopicIds = new Set<string>();
  let followingUserIds = new Set<string>();
  if (viewer) {
    const [topicFollows, userFollows] = await Promise.all([
      prisma.topicFollow.findMany({ where: { userId: viewer.id }, select: { topicId: true } }),
      prisma.userFollow.findMany({ where: { followerId: viewer.id }, select: { followingId: true } }),
    ]);
    followingTopicIds = new Set(topicFollows.map((follow) => follow.topicId));
    followingUserIds = new Set(userFollows.map((follow) => follow.followingId));
  }

  const withScores = (questions as unknown as QuestionCardRecord[]).map((question) => {
    const ageHours = Math.max(0, (Date.now() - question.createdAt.getTime()) / 3_600_000);
    const topicBonus = question.topics.some(({ topic }) => followingTopicIds.has(topic.id)) ? 40 : 0;
    const authorBonus = followingUserIds.has(question.author.id) ? 32 : 0;
    const engagement = (question.answers.reduce((sum, answer) => sum + answer._count.votes, 0) + question._count.votes) * 3 + question._count.answers * 5 + question._count.bookmarks * 2;
    const freshness = Math.max(0, 32 - ageHours / 3);
    const unansweredBonus = question._count.answers === 0 ? 12 : 0;
    return questionCard(question, Math.round(topicBonus + authorBonus + engagement + freshness + unansweredBonus));
  });

  const sorted = filters.sort === "recommended" ? withScores.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : withScores;
  const visible = sorted.slice(0, take);
  const hasMore = filters.sort === "recommended" ? questions.length > take : questions.length > take;
  return {
    questions: visible,
    nextCursor: hasMore ? questions[Math.min(take, questions.length) - 1]?.id ?? null : null,
    topics: topics.map((topic) => ({ id: topic.id, name: topic.name, slug: topic.slug, description: topic.description, questionCount: topic._count.questions, followerCount: topic._count.followers, following: topic.followers.length > 0 })),
    recommendedUsers: recommendedUsers.map((user) => ({ id: user.id, name: user.name, username: user.username, avatarUrl: user.profile?.avatarUrl ?? null, college: user.profile?.college ?? null, followerCount: user._count.followedBy, following: user.followedBy.length > 0 })),
  };
}

export async function getQuestionBySlug(slug: string, viewer: Viewer) {
  const question = await prisma.question.findFirst({
    where: { AND: [{ slug }, publicQuestionWhere] },
    include: {
      author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true, college: true, campus: true } } } },
      topics: { include: { topic: { select: { id: true, name: true, slug: true } } } },
      bookmarks: viewer ? { where: { userId: viewer.id }, select: { userId: true } } : { take: 0, select: { userId: true } },
      comments: {
        where: rootCommentWhere, orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } },
          replies: { where: publicCommentWhere, include: { author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } } } },
        },
      },
      answers: {
        where: publicAnswerWhere, orderBy: [{ accepted: "desc" }, { createdAt: "asc" }],
        include: {
          author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true, college: true } } } },
          votes: viewer ? { where: { userId: viewer.id }, select: { userId: true } } : { take: 0, select: { userId: true } },
          _count: { select: { votes: true, comments: true } },
          comments: {
            where: rootCommentWhere, orderBy: { createdAt: "asc" },
            include: {
              author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } },
              replies: { where: publicCommentWhere, include: { author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } } } },
            },
          },
        },
      },
    },
  });
  if (!question) return null;
  await prisma.question.update({ where: { id: question.id }, data: { viewCount: { increment: 1 } } });
  const comment = (value: typeof question.comments[number]) => ({
    id: value.id, body: value.body, createdAt: value.createdAt.toISOString(), author: { id: value.author.id, name: value.author.name, username: value.author.username, avatarUrl: value.author.profile?.avatarUrl ?? null },
    replies: value.replies.map((reply) => ({ id: reply.id, body: reply.body, createdAt: reply.createdAt.toISOString(), author: { id: reply.author.id, name: reply.author.name, username: reply.author.username, avatarUrl: reply.author.profile?.avatarUrl ?? null } })),
  });
  return {
    id: question.id, title: question.title, slug: question.slug, body: question.body, viewCount: question.viewCount + 1, createdAt: question.createdAt.toISOString(), updatedAt: question.updatedAt.toISOString(),
    bookmarked: question.bookmarks.length > 0,
    author: { id: question.author.id, name: question.author.name, username: question.author.username, avatarUrl: question.author.profile?.avatarUrl ?? null, college: question.author.profile?.college ?? null, campus: question.author.profile?.campus ?? null },
    topics: question.topics.map(({ topic }) => topic), comments: question.comments.map(comment),
    answers: question.answers.map((answer) => ({ id: answer.id, body: answer.body, accepted: answer.accepted, createdAt: answer.createdAt.toISOString(), updatedAt: answer.updatedAt.toISOString(), upvoteCount: answer._count.votes, commentCount: answer._count.comments, upvoted: answer.votes.length > 0, author: { id: answer.author.id, name: answer.author.name, username: answer.author.username, avatarUrl: answer.author.profile?.avatarUrl ?? null, college: answer.author.profile?.college ?? null }, comments: answer.comments.map(comment) })),
  };
}

export async function createQuestion(user: CurrentUser, input: { title: string; body: string; topicIds: string[] }) {
  const topicCount = await prisma.topic.count({ where: { id: { in: input.topicIds } } });
  if (topicCount !== input.topicIds.length) throw new ApiError(422, "INVALID_TOPIC", "One or more selected topics do not exist.");
  const slug = await uniqueQuestionSlug(input.title);
  const question = await prisma.$transaction(async (tx) => {
    const created = await tx.question.create({ data: { title: input.title, slug, body: input.body, authorId: user.id, topics: { create: input.topicIds.map((topicId) => ({ topicId })) } }, include: { topics: { include: { topic: true } } } });
    await tx.activity.create({ data: { userId: user.id, type: "QUESTION_CREATED", entityId: created.id } });
    return created;
  });
  publishPublic({ type: "QUESTION_CREATED", payload: { id: question.id, slug: question.slug } });
  return { id: question.id, slug: question.slug };
}

export async function updateQuestion(user: CurrentUser, questionId: string, input: Partial<{ title: string; body: string; topicIds: string[] }>) {
  const question = await prisma.question.findUnique({ where: { id: questionId }, select: { authorId: true, status: true } });
  if (!question || question.status === ContentStatus.DELETED) throw new ApiError(404, "NOT_FOUND", "Question not found.");
  if (question.authorId !== user.id && user.role !== Role.MODERATOR && user.role !== Role.ADMIN) throw new ApiError(403, "FORBIDDEN", "You cannot edit this question.");
  if (input.topicIds) {
    const topicCount = await prisma.topic.count({ where: { id: { in: input.topicIds } } });
    if (topicCount !== input.topicIds.length) throw new ApiError(422, "INVALID_TOPIC", "One or more selected topics do not exist.");
  }
  const updated = await prisma.question.update({
    where: { id: questionId },
    data: { ...(input.title ? { title: input.title } : {}), ...(input.body ? { body: input.body } : {}), ...(input.topicIds ? { topics: { deleteMany: {}, create: input.topicIds.map((topicId) => ({ topicId })) } } : {}) },
    select: { id: true, slug: true },
  });
  publishPublic({ type: "QUESTION_CREATED", payload: { id: updated.id, slug: updated.slug, updated: true } });
  return updated;
}

export async function deleteQuestion(user: CurrentUser, questionId: string) {
  const question = await prisma.question.findUnique({ where: { id: questionId }, select: { authorId: true } });
  if (!question) throw new ApiError(404, "NOT_FOUND", "Question not found.");
  if (question.authorId !== user.id && user.role !== Role.MODERATOR && user.role !== Role.ADMIN) throw new ApiError(403, "FORBIDDEN", "You cannot delete this question.");
  await prisma.question.update({ where: { id: questionId }, data: { status: ContentStatus.DELETED, deletedAt: new Date() } });
}

export async function createAnswer(user: CurrentUser, questionId: string, body: string) {
  const question = await prisma.question.findFirst({ where: { AND: [{ id: questionId }, publicQuestionWhere] }, select: { id: true, slug: true, authorId: true, title: true } });
  if (!question) throw new ApiError(404, "NOT_FOUND", "Question not found.");
  const answer = await prisma.$transaction(async (tx) => {
    const created = await tx.answer.create({ data: { questionId, authorId: user.id, body }, include: { author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true, college: true } } } }, _count: { select: { votes: true, comments: true } } } });
    await tx.activity.create({ data: { userId: user.id, type: "ANSWER_CREATED", entityId: created.id } });
    if (question.authorId !== user.id) {
      await tx.notification.create({ data: { userId: question.authorId, actorId: user.id, type: NotificationType.ANSWER_CREATED, entityId: question.slug, message: `${user.name} answered your question: ${question.title}` } });
    }
    return created;
  });
  publishPublic({ type: "ANSWER_CREATED", payload: { questionId, answerId: answer.id, slug: question.slug } });
  if (question.authorId !== user.id) publishUser(question.authorId, { type: "NOTIFICATION_CREATED", payload: { entityId: questionId } });
  return { id: answer.id, body: answer.body, accepted: answer.accepted, createdAt: answer.createdAt.toISOString(), upvoteCount: 0, commentCount: 0, upvoted: false, author: { id: answer.author.id, name: answer.author.name, username: answer.author.username, avatarUrl: answer.author.profile?.avatarUrl ?? null, college: answer.author.profile?.college ?? null }, comments: [] };
}

export async function updateAnswer(user: CurrentUser, answerId: string, body: string) {
  const answer = await prisma.answer.findUnique({ where: { id: answerId }, select: { authorId: true, questionId: true } });
  if (!answer) throw new ApiError(404, "NOT_FOUND", "Answer not found.");
  if (answer.authorId !== user.id && user.role !== Role.MODERATOR && user.role !== Role.ADMIN) throw new ApiError(403, "FORBIDDEN", "You cannot edit this answer.");
  const updated = await prisma.answer.update({ where: { id: answerId }, data: { body }, select: { id: true, questionId: true } });
  publishPublic({ type: "ANSWER_UPDATED", payload: { questionId: updated.questionId, answerId } });
  return updated;
}

export async function deleteAnswer(user: CurrentUser, answerId: string) {
  const answer = await prisma.answer.findUnique({ where: { id: answerId }, select: { authorId: true, questionId: true } });
  if (!answer) throw new ApiError(404, "NOT_FOUND", "Answer not found.");
  if (answer.authorId !== user.id && user.role !== Role.MODERATOR && user.role !== Role.ADMIN) throw new ApiError(403, "FORBIDDEN", "You cannot delete this answer.");
  await prisma.answer.update({ where: { id: answerId }, data: { status: ContentStatus.DELETED, deletedAt: new Date() } });
  publishPublic({ type: "ANSWER_DELETED", payload: { questionId: answer.questionId, answerId } });
}

export async function acceptAnswer(user: CurrentUser, answerId: string) {
  const answer = await prisma.answer.findUnique({ where: { id: answerId }, include: { question: { select: { id: true, authorId: true, title: true } } } });
  if (!answer || answer.status !== ContentStatus.PUBLISHED) throw new ApiError(404, "NOT_FOUND", "Answer not found.");
  if (answer.question.authorId !== user.id) throw new ApiError(403, "FORBIDDEN", "Only the question author can accept an answer.");
  const accepted = await prisma.$transaction(async (tx) => {
    await tx.answer.updateMany({ where: { questionId: answer.questionId, accepted: true }, data: { accepted: false } });
    const updated = await tx.answer.update({ where: { id: answerId }, data: { accepted: true }, select: { id: true, questionId: true } });
    if (answer.authorId !== user.id) await tx.notification.create({ data: { userId: answer.authorId, actorId: user.id, type: NotificationType.ANSWER_ACCEPTED, entityId: answerId, message: `${user.name} accepted your answer.` } });
    return updated;
  });
  publishPublic({ type: "ANSWER_UPDATED", payload: { questionId: accepted.questionId, answerId, accepted: true } });
  if (answer.authorId !== user.id) publishUser(answer.authorId, { type: "NOTIFICATION_CREATED", payload: { entityId: answerId } });
  return accepted;
}

export async function toggleAnswerVote(user: CurrentUser, answerId: string, shouldVote: boolean) {
  const answer = await prisma.answer.findFirst({ where: { AND: [{ id: answerId }, publicAnswerWhere] }, include: { question: { select: { id: true, authorId: true, title: true } } } });
  if (!answer) throw new ApiError(404, "NOT_FOUND", "Answer not found.");
  if (answer.authorId === user.id) throw new ApiError(422, "OWN_CONTENT", "You cannot upvote your own answer.");
  if (shouldVote) {
    await prisma.$transaction(async (tx) => {
      await tx.answerVote.upsert({ where: { userId_answerId: { userId: user.id, answerId } }, create: { userId: user.id, answerId }, update: {} });
      await tx.activity.create({ data: { userId: user.id, type: "ANSWER_UPVOTED", entityId: answerId } });
      await tx.notification.create({ data: { userId: answer.authorId, actorId: user.id, type: NotificationType.ANSWER_UPVOTED, entityId: answerId, message: `${user.name} upvoted your answer.` } });
    });
    publishUser(answer.authorId, { type: "NOTIFICATION_CREATED", payload: { entityId: answerId } });
  } else {
    await prisma.answerVote.deleteMany({ where: { userId: user.id, answerId } });
  }
  const count = await prisma.answerVote.count({ where: { answerId } });
  publishPublic({ type: shouldVote ? "UPVOTE_CREATED" : "UPVOTE_REMOVED", payload: { questionId: answer.questionId, answerId, upvoteCount: count } });
  return { upvoted: shouldVote, upvoteCount: count };
}

export async function createComment(user: CurrentUser, target: { questionId?: string; answerId?: string }, body: string, parentId?: string) {
  if (!target.questionId && !target.answerId) throw new ApiError(422, "INVALID_TARGET", "Choose content to comment on.");
  const [question, answer, parent] = await Promise.all([
    target.questionId ? prisma.question.findFirst({ where: { AND: [{ id: target.questionId }, publicQuestionWhere] }, select: { id: true, authorId: true, title: true } }) : null,
    target.answerId ? prisma.answer.findFirst({ where: { AND: [{ id: target.answerId }, publicAnswerWhere] }, select: { id: true, authorId: true, questionId: true } }) : null,
    parentId ? prisma.comment.findUnique({ where: { id: parentId }, select: { id: true, authorId: true, questionId: true, answerId: true } }) : null,
  ]);
  if ((target.questionId && !question) || (target.answerId && !answer)) throw new ApiError(404, "NOT_FOUND", "Content not found.");
  if (parent && (parent.questionId !== (target.questionId ?? null) || parent.answerId !== (target.answerId ?? null))) throw new ApiError(422, "INVALID_REPLY", "Reply target does not match this discussion.");
  const recipientId = parent?.authorId ?? answer?.authorId ?? question?.authorId;
  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({ data: { authorId: user.id, body, questionId: target.questionId, answerId: target.answerId, parentId }, include: { author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } } } });
    await tx.activity.create({ data: { userId: user.id, type: "COMMENT_CREATED", entityId: created.id } });
    if (recipientId && recipientId !== user.id) await tx.notification.create({ data: { userId: recipientId, actorId: user.id, type: parent ? NotificationType.COMMENT_REPLIED : NotificationType.COMMENT_CREATED, entityId: created.id, message: parent ? `${user.name} replied to your comment.` : `${user.name} commented on your post.` } });
    return created;
  });
  const questionId = target.questionId ?? answer?.questionId;
  if (questionId) publishPublic({ type: "COMMENT_CREATED", payload: { questionId, commentId: comment.id, answerId: target.answerId } });
  if (recipientId && recipientId !== user.id) publishUser(recipientId, { type: "NOTIFICATION_CREATED", payload: { entityId: comment.id } });
  return { id: comment.id, body: comment.body, createdAt: comment.createdAt.toISOString(), author: { id: comment.author.id, name: comment.author.name, username: comment.author.username, avatarUrl: comment.author.profile?.avatarUrl ?? null }, replies: [] };
}

export async function updateComment(user: CurrentUser, commentId: string, body: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true } });
  if (!comment) throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  if (comment.authorId !== user.id && user.role !== Role.MODERATOR && user.role !== Role.ADMIN) throw new ApiError(403, "FORBIDDEN", "You cannot edit this comment.");
  return prisma.comment.update({ where: { id: commentId }, data: { body }, select: { id: true, body: true, updatedAt: true } });
}

export async function deleteComment(user: CurrentUser, commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true } });
  if (!comment) throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  if (comment.authorId !== user.id && user.role !== Role.MODERATOR && user.role !== Role.ADMIN) throw new ApiError(403, "FORBIDDEN", "You cannot delete this comment.");
  await prisma.comment.update({ where: { id: commentId }, data: { status: ContentStatus.DELETED, deletedAt: new Date() } });
}

export async function toggleBookmark(user: CurrentUser, questionId: string, shouldBookmark: boolean) {
  const question = await prisma.question.findFirst({ where: { AND: [{ id: questionId }, publicQuestionWhere] }, select: { id: true } });
  if (!question) throw new ApiError(404, "NOT_FOUND", "Question not found.");
  if (shouldBookmark) {
    await prisma.$transaction([prisma.bookmark.upsert({ where: { userId_questionId: { userId: user.id, questionId } }, create: { userId: user.id, questionId }, update: {} }), prisma.activity.create({ data: { userId: user.id, type: "QUESTION_BOOKMARKED", entityId: questionId } })]);
  } else await prisma.bookmark.deleteMany({ where: { userId: user.id, questionId } });
  return { bookmarked: shouldBookmark };
}

export async function toggleQuestionVote(user: CurrentUser, questionId: string, shouldLike: boolean) {
  const question = await prisma.question.findFirst({ where: { AND: [{ id: questionId }, publicQuestionWhere] }, select: { id: true } });
  if (!question) throw new ApiError(404, "NOT_FOUND", "Question not found.");
  if (shouldLike) await prisma.questionVote.upsert({ where: { userId_questionId: { userId: user.id, questionId } }, create: { userId: user.id, questionId }, update: {} });
  else await prisma.questionVote.deleteMany({ where: { userId: user.id, questionId } });
  const likeCount = await prisma.questionVote.count({ where: { questionId } });
  publishPublic({ type: shouldLike ? "QUESTION_LIKED" : "QUESTION_UNLIKED", payload: { questionId, likeCount } });
  return { liked: shouldLike, likeCount };
}

export async function toggleUserFollow(user: CurrentUser, targetUserId: string, shouldFollow: boolean) {
  if (user.id === targetUserId) throw new ApiError(422, "INVALID_FOLLOW", "You cannot follow yourself.");
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, isSuspended: true } });
  if (!target || target.isSuspended) throw new ApiError(404, "NOT_FOUND", "User not found.");
  if (shouldFollow) {
    await prisma.$transaction(async (tx) => {
      await tx.userFollow.upsert({ where: { followerId_followingId: { followerId: user.id, followingId: targetUserId } }, create: { followerId: user.id, followingId: targetUserId }, update: {} });
      await tx.activity.create({ data: { userId: user.id, type: "USER_FOLLOWED", entityId: targetUserId } });
      await tx.notification.create({ data: { userId: targetUserId, actorId: user.id, type: NotificationType.USER_FOLLOWED, entityId: user.id, message: `${user.name} followed you.` } });
    });
    publishUser(targetUserId, { type: "NOTIFICATION_CREATED", payload: { entityId: user.id } });
    publishPublic({ type: "USER_FOLLOWED", payload: { userId: targetUserId } });
  } else await prisma.userFollow.deleteMany({ where: { followerId: user.id, followingId: targetUserId } });
  return { following: shouldFollow };
}

export async function toggleTopicFollow(user: CurrentUser, topicId: string, shouldFollow: boolean) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { id: true } });
  if (!topic) throw new ApiError(404, "NOT_FOUND", "Topic not found.");
  if (shouldFollow) {
    await prisma.$transaction([prisma.topicFollow.upsert({ where: { userId_topicId: { userId: user.id, topicId } }, create: { userId: user.id, topicId }, update: {} }), prisma.activity.create({ data: { userId: user.id, type: "TOPIC_FOLLOWED", entityId: topicId } })]);
  } else await prisma.topicFollow.deleteMany({ where: { userId: user.id, topicId } });
  return { following: shouldFollow };
}

export async function getNotifications(userId: string) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } } } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { unreadCount, notifications: notifications.map((notification) => ({ id: notification.id, type: notification.type, entityId: notification.entityId, message: notification.message, readAt: notification.readAt?.toISOString() ?? null, createdAt: notification.createdAt.toISOString(), actor: notification.actor ? { id: notification.actor.id, name: notification.actor.name, username: notification.actor.username, avatarUrl: notification.actor.profile?.avatarUrl ?? null } : null })) };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const updated = await prisma.notification.updateMany({ where: { id: notificationId, userId, readAt: null }, data: { readAt: new Date() } });
  if (!updated.count) throw new ApiError(404, "NOT_FOUND", "Notification not found.");
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

export async function getBookmarks(user: Viewer) {
  if (!user) return [];
  const bookmarks = await prisma.bookmark.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { question: { include: cardInclude(user.id) } } });
  return bookmarks.filter((bookmark) => bookmark.question.status === ContentStatus.PUBLISHED).map((bookmark) => questionCard(bookmark.question as unknown as QuestionCardRecord));
}

export async function getPublicProfile(username: string, viewer: Viewer) {
  const user = await prisma.user.findFirst({
    where: { username, isSuspended: false },
    select: {
      id: true,
      name: true,
      username: true,
      profile: { select: { avatarUrl: true, bio: true, college: true, campus: true, course: true, interests: true } },
      _count: { select: { questions: true, answers: true, followedBy: true, following: true } },
      followedBy: viewer ? { where: { followerId: viewer.id }, select: { followerId: true } } : { take: 0, select: { followerId: true } },
      questions: { where: publicQuestionWhere, orderBy: { createdAt: "desc" }, take: 30, include: cardInclude(viewer?.id) },
    },
  });
  if (!user) return null;
  const [questionCount, answerCount] = await Promise.all([
    prisma.question.count({ where: { AND: [{ authorId: user.id }, publicQuestionWhere] } }),
    prisma.answer.count({ where: { AND: [{ authorId: user.id }, publicAnswerWhere] } }),
  ]);
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: user.profile?.avatarUrl ?? null,
    bio: user.profile?.bio ?? null,
    college: user.profile?.college ?? null,
    campus: user.profile?.campus ?? null,
    course: user.profile?.course ?? null,
    interests: user.profile?.interests ?? [],
    questionCount,
    answerCount,
    followerCount: user._count.followedBy,
    followingCount: user._count.following,
    following: user.followedBy.length > 0,
    questions: (user.questions as unknown as QuestionCardRecord[]).map((question) => questionCard(question)),
  };
}

export async function createReport(user: CurrentUser, input: { questionId?: string; answerId?: string; commentId?: string; reason: string }) {
  const report = await prisma.report.create({ data: { ...input, reporterId: user.id } });
  await prisma.activity.create({ data: { userId: user.id, type: "CONTENT_REPORTED", entityId: report.id } });
  return { id: report.id };
}

export async function searchCommunity(query: string, type: "all" | "questions" | "answers" | "users" | "topics", take = 20) {
  const contains = { contains: query, mode: "insensitive" as const };
  const [questions, answers, users, topics] = await Promise.all([
    type === "all" || type === "questions" ? prisma.question.findMany({ where: { AND: [publicQuestionWhere, { OR: [{ title: contains }, { body: contains }] }] }, orderBy: { createdAt: "desc" }, take, include: cardInclude() }) : [],
    type === "all" || type === "answers" ? prisma.answer.findMany({ where: { AND: [publicAnswerWhere, { body: contains }] }, orderBy: { createdAt: "desc" }, take, include: { question: { select: { slug: true, title: true } }, author: { select: { id: true, name: true, username: true } } } }) : [],
    type === "all" || type === "users" ? prisma.user.findMany({ where: { isSuspended: false, OR: [{ name: contains }, { username: contains }] }, take, select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true, college: true } } } }) : [],
    type === "all" || type === "topics" ? prisma.topic.findMany({ where: { OR: [{ name: contains }, { description: contains }] }, take, select: { id: true, name: true, slug: true, description: true } }) : [],
  ]);
  return { questions: (questions as unknown as QuestionCardRecord[]).map((question) => questionCard(question)), answers: answers.map((answer) => ({ id: answer.id, body: answer.body, createdAt: answer.createdAt.toISOString(), question: answer.question, author: answer.author })), users: users.map((user) => ({ id: user.id, name: user.name, username: user.username, avatarUrl: user.profile?.avatarUrl ?? null, college: user.profile?.college ?? null })), topics };
}

export async function adminAnalytics() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [users, questions, answers, comments, reports, unreadReports, newUsers, newQuestions, recentReports] = await Promise.all([
    prisma.user.count(), prisma.question.count({ where: publicQuestionWhere }), prisma.answer.count({ where: publicAnswerWhere }), prisma.comment.count({ where: publicCommentWhere }), prisma.report.count(), prisma.report.count({ where: { status: "OPEN" } }), prisma.user.count({ where: { createdAt: { gte: since } } }), prisma.question.count({ where: { AND: [publicQuestionWhere, { createdAt: { gte: since } }] } }),
    prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { reporter: { select: { name: true, username: true } } } }),
  ]);
  return { metrics: { users, questions, answers, comments, reports, unreadReports, newUsers, newQuestions, engagement: answers + comments }, recentReports: recentReports.map((report) => ({ id: report.id, reason: report.reason, status: report.status, createdAt: report.createdAt.toISOString(), reporter: report.reporter })) };
}
