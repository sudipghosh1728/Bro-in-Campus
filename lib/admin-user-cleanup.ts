import type { Prisma } from "@prisma/client";
import { Role } from "./domain";
import { refreshCampusDecisions } from "./campus-consensus";

export async function purgeNonAdminUsers(tx: Prisma.TransactionClient, targetId?: string) {
  const users = await tx.user.findMany({
    where: { role: { not: Role.ADMIN }, ...(targetId ? { id: targetId } : {}) },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  if (!userIds.length) return 0;
  const campusVotes = await tx.campusDecisionVote.findMany({ where: { userId: { in: userIds } }, select: { decisionId: true } });

  const [questions, issues, events, opportunities] = await Promise.all([
    tx.question.findMany({ where: { authorId: { in: userIds } }, select: { id: true } }),
    tx.communityIssue.findMany({ where: { reporterId: { in: userIds } }, select: { id: true } }),
    tx.campusEvent.findMany({ where: { createdById: { in: userIds } }, select: { id: true } }),
    tx.careerOpportunity.findMany({ where: { postedById: { in: userIds } }, select: { id: true } }),
  ]);
  const questionIds = questions.map(({ id }) => id);
  const issueIds = issues.map(({ id }) => id);
  const eventIds = events.map(({ id }) => id);
  const opportunityIds = opportunities.map(({ id }) => id);
  const answers = await tx.answer.findMany({
    where: { OR: [{ authorId: { in: userIds } }, ...(questionIds.length ? [{ questionId: { in: questionIds } }] : [])] },
    select: { id: true },
  });
  const answerIds = answers.map(({ id }) => id);
  const rootComments = await tx.comment.findMany({
    where: {
      OR: [
        { authorId: { in: userIds } },
        ...(questionIds.length ? [{ questionId: { in: questionIds } }] : []),
        ...(answerIds.length ? [{ answerId: { in: answerIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const firstCommentLevel = rootComments.map(({ id }) => id);
  const commentLevels = firstCommentLevel.length ? [firstCommentLevel] : [];
  const knownCommentIds = new Set(firstCommentLevel);
  let commentFrontier = firstCommentLevel;
  while (commentFrontier.length) {
    const children = await tx.comment.findMany({ where: { parentId: { in: commentFrontier } }, select: { id: true } });
    const childIds = children.map(({ id }) => id).filter((id) => !knownCommentIds.has(id));
    if (!childIds.length) break;
    childIds.forEach((id) => knownCommentIds.add(id));
    commentLevels.push(childIds);
    commentFrontier = childIds;
  }
  const commentIds = [...knownCommentIds];

  const reportFilters = [
    { reporterId: { in: userIds } },
    ...(questionIds.length ? [{ questionId: { in: questionIds } }] : []),
    ...(answerIds.length ? [{ answerId: { in: answerIds } }] : []),
    ...(commentIds.length ? [{ commentId: { in: commentIds } }] : []),
  ];

  await Promise.all([
    tx.report.deleteMany({ where: { OR: reportFilters } }),
    tx.questionTopic.deleteMany({ where: { questionId: { in: questionIds } } }),
    tx.answerVote.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { answerId: { in: answerIds } }] } }),
    tx.bookmark.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { questionId: { in: questionIds } }] } }),
    tx.questionVote.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { questionId: { in: questionIds } }] } }),
    tx.issueVote.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { issueId: { in: issueIds } }] } }),
    tx.learningPathProgress.deleteMany({ where: { userId: { in: userIds } } }),
    tx.campusDecisionVote.deleteMany({ where: { userId: { in: userIds } } }),
    tx.collegeMembership.deleteMany({ where: { userId: { in: userIds } } }),
    tx.session.deleteMany({ where: { userId: { in: userIds } } }),
    tx.passwordResetOtp.deleteMany({ where: { userId: { in: userIds } } }),
    tx.profile.deleteMany({ where: { userId: { in: userIds } } }),
    tx.userFollow.deleteMany({ where: { OR: [{ followerId: { in: userIds } }, { followingId: { in: userIds } }] } }),
    tx.topicFollow.deleteMany({ where: { userId: { in: userIds } } }),
    tx.notification.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { actorId: { in: userIds } }] } }),
    tx.activity.deleteMany({ where: { userId: { in: userIds } } }),
    tx.media.deleteMany({ where: { userId: { in: userIds } } }),
    tx.eventRsvp.deleteMany({ where: { OR: [{ userId: { in: userIds } }, ...(eventIds.length ? [{ eventId: { in: eventIds } }] : [])] } }),
    tx.opportunitySave.deleteMany({ where: { OR: [{ userId: { in: userIds } }, ...(opportunityIds.length ? [{ opportunityId: { in: opportunityIds } }] : [])] } }),
    tx.companyReview.deleteMany({ where: { authorId: { in: userIds } } }),
    tx.serviceRequest.deleteMany({ where: { userId: { in: userIds } } }),
    tx.produceListing.deleteMany({ where: { reportedById: { in: userIds } } }),
    tx.contentModeration.deleteMany({ where: { userId: { in: userIds } } }),
    tx.newsletterSubscription.deleteMany({ where: { userId: { in: userIds } } }),
    tx.college.updateMany({ where: { listedById: { in: userIds } }, data: { listedById: null } }),
    tx.adminImpersonation.updateMany({ where: { adminId: { in: userIds } }, data: { adminEmail: "[deleted account]" } }),
    tx.adminImpersonation.updateMany({ where: { targetId: { in: userIds } }, data: { targetEmail: "[deleted account]" } }),
  ]);

  for (const level of commentLevels.reverse()) {
    if (level.length) await tx.comment.deleteMany({ where: { id: { in: level } } });
  }
  if (answerIds.length) await tx.answer.deleteMany({ where: { id: { in: answerIds } } });
  if (questionIds.length) await tx.question.deleteMany({ where: { id: { in: questionIds } } });
  if (issueIds.length) await tx.communityIssue.deleteMany({ where: { id: { in: issueIds } } });
  if (eventIds.length) await tx.campusEvent.deleteMany({ where: { id: { in: eventIds } } });
  if (opportunityIds.length) await tx.careerOpportunity.deleteMany({ where: { id: { in: opportunityIds } } });

  const deleted = await tx.user.deleteMany({ where: { id: { in: userIds }, role: { not: Role.ADMIN } } });
  await refreshCampusDecisions(tx, campusVotes.map((vote) => vote.decisionId));
  return deleted.count;
}
