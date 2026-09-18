import { ApiError } from "./api";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { CurrentUser } from "./auth";
import { ContentStatus, EventRsvpStatus, OpportunityStatus, ServiceRequestStatus } from "./domain";

type Viewer = Pick<CurrentUser, "id"> | null;

function activeOpportunityWhere(): Prisma.CareerOpportunityWhereInput {
  return {
    status: OpportunityStatus.OPEN,
    OR: [
      { deadline: { gte: new Date() } },
      { deadline: null },
      { deadline: { isSet: false } },
    ],
  };
}

function eventSummary(event: {
  id: string; title: string; description: string; location: string; startsAt: Date; endsAt: Date | null;
  capacity: number | null; kind: string; coverColor: string; _count: { rsvps: number }; rsvps: { status: string }[];
}) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    capacity: event.capacity,
    kind: event.kind,
    coverColor: event.coverColor,
    goingCount: event._count.rsvps,
    rsvpStatus: (event.rsvps[0]?.status === "GOING" || event.rsvps[0]?.status === "WAITLISTED" ? event.rsvps[0].status : null) as "GOING" | "WAITLISTED" | null,
  };
}

export async function getCampusEvents(viewer: Viewer) {
  const events = await prisma.campusEvent.findMany({
    where: { startsAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
    orderBy: { startsAt: "asc" },
    take: 24,
    include: {
      _count: { select: { rsvps: { where: { status: EventRsvpStatus.GOING } } } },
      rsvps: viewer ? { where: { userId: viewer.id }, select: { status: true } } : { take: 0, select: { status: true } },
    },
  });
  return events.map((event) => eventSummary(event));
}

export async function getCampusRequests(user: Pick<CurrentUser, "id">) {
  const requests = await prisma.serviceRequest.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 20 });
  return requests.map((request) => ({ ...request, createdAt: request.createdAt.toISOString(), updatedAt: request.updatedAt.toISOString() }));
}

export async function getCampusOverview(viewer: Viewer) {
  const [events, requests] = await Promise.all([
    getCampusEvents(viewer),
    viewer ? getCampusRequests(viewer) : Promise.resolve([]),
  ]);
  return {
    events,
    requests,
    support: {
      open: requests.filter((request) => request.status === ServiceRequestStatus.OPEN || request.status === ServiceRequestStatus.IN_PROGRESS).length,
      resolved: requests.filter((request) => request.status === ServiceRequestStatus.RESOLVED).length,
    },
  };
}

export async function toggleEventRsvp(user: CurrentUser, eventId: string, shouldAttend: boolean) {
  const event = await prisma.campusEvent.findUnique({ where: { id: eventId }, select: { id: true, startsAt: true, capacity: true } });
  if (!event || event.startsAt < new Date()) throw new ApiError(404, "NOT_FOUND", "This event is no longer available.");
  const [existing, goingCount] = await Promise.all([
    prisma.eventRsvp.findUnique({ where: { userId_eventId: { userId: user.id, eventId } }, select: { status: true } }),
    prisma.eventRsvp.count({ where: { eventId, status: EventRsvpStatus.GOING } }),
  ]);
  if (!shouldAttend) {
    await prisma.eventRsvp.deleteMany({ where: { userId: user.id, eventId } });
    return { attending: false, rsvpStatus: null, goingCount: Math.max(0, goingCount - (existing?.status === EventRsvpStatus.GOING ? 1 : 0)) };
  }
  const status = existing?.status === EventRsvpStatus.GOING || event.capacity === null || goingCount < event.capacity ? EventRsvpStatus.GOING : EventRsvpStatus.WAITLISTED;
  await prisma.eventRsvp.upsert({ where: { userId_eventId: { userId: user.id, eventId } }, create: { userId: user.id, eventId, status }, update: { status } });
  return { attending: true, rsvpStatus: status, goingCount: goingCount + (existing?.status === EventRsvpStatus.GOING || status !== EventRsvpStatus.GOING ? 0 : 1) };
}

export async function createServiceRequest(user: CurrentUser, input: { title: string; description: string; category: "MAINTENANCE" | "HOSTEL" | "TRANSPORT" | "IT" | "ACADEMIC" | "OTHER"; location?: string }) {
  const request = await prisma.serviceRequest.create({ data: { ...input, location: input.location || null, userId: user.id } });
  return { ...request, createdAt: request.createdAt.toISOString(), updatedAt: request.updatedAt.toISOString() };
}

export async function getCareerDirectory(viewer: Viewer, options: { q?: string; type?: string } = {}) {
  const opportunityConditions: Prisma.CareerOpportunityWhereInput[] = [activeOpportunityWhere()];
  if (options.type) opportunityConditions.push({ employmentType: options.type as "INTERNSHIP" | "FULL_TIME" | "PART_TIME" | "APPRENTICESHIP" });
  if (options.q) opportunityConditions.push({ OR: [{ title: { contains: options.q, mode: "insensitive" } }, { location: { contains: options.q, mode: "insensitive" } }, { company: { is: { name: { contains: options.q, mode: "insensitive" } } } }] });
  const opportunityWhere: Prisma.CareerOpportunityWhereInput = { AND: opportunityConditions };
  const [companies, opportunities] = await Promise.all([
    prisma.company.findMany({
      where: options.q ? { OR: [{ name: { contains: options.q, mode: "insensitive" } }, { industry: { contains: options.q, mode: "insensitive" } }] } : undefined,
      orderBy: { reviews: { _count: "desc" } },
      take: 20,
      include: { reviews: { where: { status: ContentStatus.PUBLISHED }, select: { rating: true } }, _count: { select: { reviews: true, jobs: { where: activeOpportunityWhere() } } } },
    }),
    prisma.careerOpportunity.findMany({
      where: opportunityWhere,
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
      take: 30,
      include: { company: { select: { name: true, slug: true, logoColor: true } }, saves: viewer ? { where: { userId: viewer.id }, select: { userId: true } } : { take: 0, select: { userId: true } } },
    }),
  ]);
  return {
    companies: companies.map((company) => ({
      id: company.id, name: company.name, slug: company.slug, industry: company.industry, location: company.location, logoColor: company.logoColor,
      rating: company.reviews.length ? Math.round((company.reviews.reduce((total, review) => total + review.rating, 0) / company.reviews.length) * 10) / 10 : null,
      reviewCount: company._count.reviews, jobCount: company._count.jobs,
    })),
    opportunities: opportunities.map((job) => ({
      id: job.id, title: job.title, location: job.location, employmentType: job.employmentType, stipend: job.stipend, description: job.description, skills: job.skills,
      applicationUrl: job.applicationUrl, deadline: job.deadline?.toISOString() ?? null, createdAt: job.createdAt.toISOString(), saved: job.saves.length > 0,
      company: job.company,
    })),
  };
}

export async function getCompanyProfile(slug: string, viewer: Viewer) {
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      reviews: { where: { status: ContentStatus.PUBLISHED }, orderBy: { createdAt: "desc" }, take: 40, include: { author: { select: { name: true, username: true } } } },
      jobs: { where: activeOpportunityWhere(), orderBy: { deadline: "asc" }, include: { saves: viewer ? { where: { userId: viewer.id }, select: { userId: true } } : { take: 0, select: { userId: true } } } },
    },
  });
  if (!company) return null;
  const rating = company.reviews.length ? Math.round((company.reviews.reduce((total, review) => total + review.rating, 0) / company.reviews.length) * 10) / 10 : null;
  return {
    id: company.id, name: company.name, slug: company.slug, industry: company.industry, location: company.location, website: company.website, description: company.description, logoColor: company.logoColor, rating,
    reviews: company.reviews.map((review) => ({ id: review.id, rating: review.rating, title: review.title, pros: review.pros, cons: review.cons, role: review.role, isAnonymous: review.isAnonymous, author: review.isAnonymous ? null : review.author, createdAt: review.createdAt.toISOString() })),
    jobs: company.jobs.map((job) => ({ id: job.id, title: job.title, location: job.location, employmentType: job.employmentType, stipend: job.stipend, description: job.description, skills: job.skills, applicationUrl: job.applicationUrl, deadline: job.deadline?.toISOString() ?? null, saved: job.saves.length > 0 })),
  };
}

export async function createCompanyReview(user: CurrentUser, companyId: string, input: { rating: number; title: string; pros: string; cons?: string; role?: string; isAnonymous?: boolean }) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) throw new ApiError(404, "NOT_FOUND", "Company not found.");
  const review = await prisma.companyReview.create({ data: { ...input, cons: input.cons || null, role: input.role || null, isAnonymous: input.isAnonymous ?? false, companyId, authorId: user.id } });
  return { id: review.id };
}

export async function toggleOpportunitySave(user: CurrentUser, opportunityId: string, shouldSave: boolean) {
  const opportunity = await prisma.careerOpportunity.findFirst({ where: { AND: [{ id: opportunityId }, activeOpportunityWhere()] }, select: { id: true } });
  if (!opportunity) throw new ApiError(404, "NOT_FOUND", "Opportunity not found.");
  if (shouldSave) await prisma.opportunitySave.upsert({ where: { userId_opportunityId: { userId: user.id, opportunityId } }, create: { userId: user.id, opportunityId }, update: {} });
  else await prisma.opportunitySave.deleteMany({ where: { userId: user.id, opportunityId } });
  return { saved: shouldSave };
}
