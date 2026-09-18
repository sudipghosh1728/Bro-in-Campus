import { ApiError } from "./api";
import type { CurrentUser } from "./auth";
import { IssueManagerProfessions, NotificationType } from "./domain";
import { prisma } from "./prisma";
import { publishPublic, publishUser } from "./realtime";

type Viewer = Pick<CurrentUser, "id"> | null;
type Coordinates = { latitude: number; longitude: number };

function toRadians(value: number) { return value * Math.PI / 180; }
function distanceKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const latitude = toRadians(to.latitude - from.latitude);
  const longitude = toRadians(to.longitude - from.longitude);
  const a = Math.sin(latitude / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(longitude / 2) ** 2;
  return Math.round((earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 10) / 10;
}

async function membershipFor(userId: string, collegeId: string) {
  const membership = await prisma.collegeMembership.findUnique({ where: { userId_collegeId: { userId, collegeId } }, select: { id: true } });
  if (!membership) throw new ApiError(403, "NOT_A_MEMBER", "Join this residence before contributing to its shared living board.");
}

function marketSummary(market: {
  id: string; name: string; category: string; address: string | null; latitude: number | null; longitude: number | null; distanceKm: number | null; source: string; lastSyncedAt: Date | null;
  produce: { id: string; name: string; category: string; availability: string; priceNote: string | null; verifiedAt: Date; reportedBy: { name: string } | null }[];
}) {
  return {
    id: market.id, name: market.name, category: market.category, address: market.address, latitude: market.latitude, longitude: market.longitude, distanceKm: market.distanceKm, source: market.source, lastSyncedAt: market.lastSyncedAt?.toISOString() ?? null,
    produce: market.produce.map((item) => ({ id: item.id, name: item.name, category: item.category, availability: item.availability, priceNote: item.priceNote, verifiedAt: item.verifiedAt.toISOString(), reportedBy: item.reportedBy?.name ?? null })),
  };
}

function issueSummary(issue: {
  id: string; title: string; description: string; category: string; severity: string; location: string | null; status: string; resolvedAt: Date | null; createdAt: Date; updatedAt: Date;
  reporter: { id: string; name: string; username: string; profile: { avatarUrl: string | null } | null }; votes: { userId: string }[]; _count: { votes: number };
}) {
  return {
    id: issue.id, title: issue.title, description: issue.description, category: issue.category, severity: issue.severity, location: issue.location, status: issue.status,
    createdAt: issue.createdAt.toISOString(), updatedAt: issue.updatedAt.toISOString(), resolvedAt: issue.resolvedAt?.toISOString() ?? null, voteCount: issue._count.votes, supported: issue.votes.length > 0,
    reporter: { id: issue.reporter.id, name: issue.reporter.name, username: issue.reporter.username, avatarUrl: issue.reporter.profile?.avatarUrl ?? null },
  };
}

export async function getResidenceLivingData(collegeId: string, viewer: Viewer) {
  const [markets, issues] = await Promise.all([
    prisma.localMarket.findMany({
      where: { collegeId },
      orderBy: [{ distanceKm: "asc" }, { updatedAt: "desc" }],
      take: 30,
      include: { produce: { orderBy: { verifiedAt: "desc" }, take: 16, include: { reportedBy: { select: { name: true } } } } },
    }),
    prisma.communityIssue.findMany({
      where: { collegeId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 40,
      include: {
        reporter: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } },
        votes: viewer ? { where: { userId: viewer.id }, select: { userId: true } } : { take: 0, select: { userId: true } },
        _count: { select: { votes: true } },
      },
    }),
  ]);
  return { markets: markets.map(marketSummary), issues: issues.map(issueSummary) };
}

export async function syncNearbyMarkets(user: CurrentUser, collegeId: string) {
  await membershipFor(user.id, collegeId);
  const residence = await prisma.college.findUnique({ where: { id: collegeId }, select: { id: true, latitude: true, longitude: true } });
  if (!residence) throw new ApiError(404, "NOT_FOUND", "Residence not found.");
  if (residence.latitude === null || residence.longitude === null) throw new ApiError(422, "LOCATION_REQUIRED", "This residence needs a location before nearby markets can be discovered. Ask the listing owner to add it from the location-enabled listing form.");
  const latitude = residence.latitude;
  const longitude = residence.longitude;
  const query = `[out:json][timeout:20];(nwr["shop"~"supermarket|greengrocer|convenience|fruit|vegetables"](around:2500,${latitude},${longitude});nwr["amenity"="marketplace"](around:2500,${latitude},${longitude}););out center tags;`;
  let payload: { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
  try {
    const response = await fetch(process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": process.env.LOCATION_USER_AGENT ?? "BroInCampus local development" }, body: new URLSearchParams({ data: query }), cache: "no-store" });
    if (!response.ok) throw new Error(`Map provider responded ${response.status}`);
    payload = await response.json() as typeof payload;
  } catch (error) {
    console.error("Nearby-market sync failed", error);
    throw new ApiError(503, "MARKET_SYNC_UNAVAILABLE", "Nearby market data is temporarily unavailable. You can still add a local market manually.");
  }
  const point = { latitude, longitude };
  const elements = (payload.elements ?? []).filter((element) => element.tags?.name).slice(0, 30);
  await Promise.all(elements.map(async (element) => {
    const marketLatitude = element.lat ?? element.center?.lat;
    const marketLongitude = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const externalId = `osm:${element.type}:${element.id}`;
    const data = {
      name: tags.name!, category: tags.shop === "greengrocer" || tags.shop === "fruit" || tags.shop === "vegetables" ? "GREENGROCER" : tags.amenity === "marketplace" ? "MARKETPLACE" : tags.shop === "supermarket" ? "SUPERMARKET" : "GROCERY",
      address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"]].filter(Boolean).join(", ") || null,
      latitude: marketLatitude ?? null, longitude: marketLongitude ?? null,
      distanceKm: marketLatitude !== undefined && marketLongitude !== undefined ? distanceKm(point, { latitude: marketLatitude, longitude: marketLongitude }) : null,
      source: "OPENSTREETMAP", lastSyncedAt: new Date(),
    };
    const existing = await prisma.localMarket.findFirst({ where: { collegeId, externalId }, select: { id: true } });
    return existing ? prisma.localMarket.update({ where: { id: existing.id }, data }) : prisma.localMarket.create({ data: { collegeId, externalId, ...data } });
  }));
  publishPublic({ type: "MARKETS_SYNCED", payload: { collegeId } });
  return getResidenceLivingData(collegeId, user);
}

export async function addLocalMarket(user: CurrentUser, collegeId: string, input: { name: string; category: string; address?: string; latitude?: number | null; longitude?: number | null }) {
  await membershipFor(user.id, collegeId);
  const residence = await prisma.college.findUnique({ where: { id: collegeId }, select: { latitude: true, longitude: true } });
  if (!residence) throw new ApiError(404, "NOT_FOUND", "Residence not found.");
  const hasMarketLocation = input.latitude !== null && input.latitude !== undefined && input.longitude !== null && input.longitude !== undefined;
  const hasResidenceLocation = residence.latitude !== null && residence.longitude !== null;
  const created = await prisma.localMarket.create({
    data: {
      collegeId, name: input.name, category: input.category, address: input.address || null, latitude: input.latitude ?? null, longitude: input.longitude ?? null, source: "COMMUNITY",
      distanceKm: hasMarketLocation && hasResidenceLocation ? distanceKm({ latitude: residence.latitude!, longitude: residence.longitude! }, { latitude: input.latitude!, longitude: input.longitude! }) : null,
    },
  });
  publishPublic({ type: "MARKET_CREATED", payload: { collegeId, marketId: created.id } });
  return created;
}

export async function addProduceListing(user: CurrentUser, marketId: string, input: { name: string; category: string; availability: string; priceNote?: string }) {
  const market = await prisma.localMarket.findUnique({ where: { id: marketId }, select: { id: true, collegeId: true } });
  if (!market) throw new ApiError(404, "NOT_FOUND", "Market not found.");
  await membershipFor(user.id, market.collegeId);
  const listing = await prisma.produceListing.create({ data: { marketId, reportedById: user.id, name: input.name, category: input.category, availability: input.availability, priceNote: input.priceNote || null } });
  publishPublic({ type: "PRODUCE_REPORTED", payload: { collegeId: market.collegeId, marketId } });
  return { id: listing.id, verifiedAt: listing.verifiedAt.toISOString() };
}

export async function createCommunityIssue(user: CurrentUser, collegeId: string, input: { title: string; description: string; category: string; severity: string; location?: string }) {
  await membershipFor(user.id, collegeId);
  const college = await prisma.college.findUnique({ where: { id: collegeId }, select: { slug: true } });
  if (!college) throw new ApiError(404, "NOT_FOUND", "Campus not found.");
  const { issue, managerIds } = await prisma.$transaction(async (tx) => {
    const created = await tx.communityIssue.create({ data: { collegeId, reporterId: user.id, title: input.title, description: input.description, category: input.category, severity: input.severity, location: input.location || null } });
    const managers = await tx.collegeMembership.findMany({
      where: {
        collegeId,
        OR: [
          { role: { in: [...IssueManagerProfessions] } },
          { user: { profile: { is: { profession: { in: [...IssueManagerProfessions] } } } } },
        ],
      },
      select: { userId: true },
    });
    const managerIds = [...new Set(managers.map((manager) => manager.userId).filter((id) => id !== user.id))];
    if (managerIds.length) await tx.notification.createMany({ data: managerIds.map((userId) => ({ userId, actorId: user.id, type: NotificationType.CAMPUS_ISSUE_REPORTED, entityId: college.slug, message: `${user.name} reported “${input.title}” in a campus you manage.` })) });
    return { issue: created, managerIds };
  });
  managerIds.forEach((userId) => publishUser(userId, { type: "NOTIFICATION_CREATED", payload: { entityId: college.slug } }));
  publishPublic({ type: "ISSUE_CREATED", payload: { collegeId, issueId: issue.id } });
  return { id: issue.id };
}

function isIssueManagerProfession(profession: string | null | undefined) {
  return [...IssueManagerProfessions].includes(profession as (typeof IssueManagerProfessions)[number]);
}

export async function resolveCommunityIssue(user: CurrentUser, issueId: string) {
  const issue = await prisma.communityIssue.findUnique({ where: { id: issueId }, select: { id: true, collegeId: true, reporterId: true, title: true, status: true, college: { select: { slug: true } } } });
  if (!issue) throw new ApiError(404, "NOT_FOUND", "Issue not found.");
  if (user.role === "USER") {
    const membership = await prisma.collegeMembership.findUnique({ where: { userId_collegeId: { userId: user.id, collegeId: issue.collegeId } }, select: { role: true } });
    if (!membership || (!isIssueManagerProfession(user.profile?.profession) && !isIssueManagerProfession(membership.role))) throw new ApiError(403, "FORBIDDEN", "Only campus teachers, authorities and administrators can mark this issue done.");
  }
  const resolvedAt = new Date();
  const updated = issue.status === "RESOLVED" ? await prisma.communityIssue.findUniqueOrThrow({ where: { id: issue.id }, select: { id: true, status: true, resolvedAt: true } }) : await prisma.communityIssue.update({ where: { id: issue.id }, data: { status: "RESOLVED", resolvedById: user.id, resolvedAt }, select: { id: true, status: true, resolvedAt: true } });
  if (issue.reporterId !== user.id && issue.status !== "RESOLVED") {
    await prisma.notification.create({ data: { userId: issue.reporterId, actorId: user.id, type: NotificationType.CAMPUS_ISSUE_RESOLVED, entityId: issue.college.slug, message: `${user.name} marked your campus issue “${issue.title}” as done.` } });
    publishUser(issue.reporterId, { type: "NOTIFICATION_CREATED", payload: { entityId: issue.college.slug } });
  }
  publishPublic({ type: "ISSUE_RESOLVED", payload: { collegeId: issue.collegeId, issueId } });
  return { ...updated, resolvedAt: updated.resolvedAt?.toISOString() ?? null };
}

export async function toggleIssueVote(user: CurrentUser, issueId: string, supported: boolean) {
  const issue = await prisma.communityIssue.findUnique({ where: { id: issueId }, select: { id: true, collegeId: true } });
  if (!issue) throw new ApiError(404, "NOT_FOUND", "Issue not found.");
  await membershipFor(user.id, issue.collegeId);
  if (supported) await prisma.issueVote.upsert({ where: { issueId_userId: { issueId, userId: user.id } }, create: { issueId, userId: user.id }, update: {} });
  else await prisma.issueVote.deleteMany({ where: { issueId, userId: user.id } });
  const voteCount = await prisma.issueVote.count({ where: { issueId } });
  publishPublic({ type: supported ? "ISSUE_SUPPORTED" : "ISSUE_UNSUPPORTED", payload: { collegeId: issue.collegeId, issueId, voteCount } });
  return { supported, voteCount };
}
