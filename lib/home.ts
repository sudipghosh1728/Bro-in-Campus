import { prisma } from "./prisma";

// The landing page needs only short previews and counts, not full feed cards,
// follower graphs, RSVP lists or student profiles. Keep private requests fresh.
export async function getHomeOverview(viewer: { id: string } | null) {
  const [colleges, students, questions, topics, events, requests] = await Promise.all([
    prisma.college.findMany({ take: 3, orderBy: [{ verified: "desc" }, { createdAt: "desc" }], select: { name: true } }),
    prisma.user.findMany({ where: { isSuspended: false }, take: 3, select: { id: true } }),
    prisma.question.findMany({
      where: { status: "PUBLISHED", OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] },
      take: 3, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { title: true },
    }),
    prisma.topic.count(),
    prisma.campusEvent.findMany({ where: { startsAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } }, take: 24, select: { id: true } }),
    viewer ? prisma.serviceRequest.findMany({ where: { userId: viewer.id }, orderBy: { updatedAt: "desc" }, take: 20, select: { status: true } }) : Promise.resolve([]),
  ]);
  return {
    colleges: { colleges }, students: { students }, community: { questions, topicCount: topics },
    campus: { events, support: { open: requests.filter((request) => request.status === "OPEN" || request.status === "IN_PROGRESS").length } },
  };
}
