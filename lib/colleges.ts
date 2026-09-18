import type { Prisma } from "@prisma/client";
import { ApiError } from "./api";
import type { CurrentUser } from "./auth";
import { Profession } from "./domain";
import { prisma } from "./prisma";
import { publishPublic } from "./realtime";

type Viewer = Pick<CurrentUser, "id"> | null;

const colors = ["indigo", "violet", "mint", "coral", "yellow"];

function membershipRoleFor(user: CurrentUser) {
  const profession = user.profile?.profession;
  return profession && Object.values(Profession).includes(profession as Profession) ? profession : Profession.STUDENT;
}

function collegeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72) || "college";
}

async function availableSlug(name: string, city: string) {
  const base = collegeSlug(`${name}-${city}`);
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix ? `${base}-${suffix + 1}` : base;
    if (!await prisma.college.findUnique({ where: { slug }, select: { id: true } })) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function collegeSummary(college: {
  id: string; name: string; slug: string; city: string; state: string | null; country: string; type: string; website: string | null;
  description: string | null; aisheCode: string | null; directorySource: string | null; address: string | null; latitude: number | null; longitude: number | null; buildingCount: number | null; residentLabel: string | null;
  coverColor: string; verified: boolean; createdAt: Date; _count: { members: number }; members: { userId: string }[];
}) {
  return {
    id: college.id,
    name: college.name,
    slug: college.slug,
    city: college.city,
    state: college.state,
    country: college.country,
    type: college.type,
    website: college.website,
    description: college.description,
    aisheCode: college.aisheCode,
    directorySource: college.directorySource,
    address: college.address,
    latitude: college.latitude,
    longitude: college.longitude,
    buildingCount: college.buildingCount,
    residentLabel: college.residentLabel,
    coverColor: college.coverColor,
    verified: college.verified,
    memberCount: college._count.members,
    joined: college.members.length > 0,
    createdAt: college.createdAt.toISOString(),
  };
}

export async function getCollegeDirectory(viewer: Viewer, options: { q?: string; take?: number } = {}) {
  const take = Math.min(Math.max(options.take ?? 36, 1), 60);
  const q = options.q?.trim();
  const where: Prisma.CollegeWhereInput | undefined = q ? {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { state: { contains: q, mode: "insensitive" } },
      { country: { contains: q, mode: "insensitive" } },
    ],
  } : undefined;
  const colleges = await prisma.college.findMany({
    where,
    take,
    orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { members: true } },
      members: viewer ? { where: { userId: viewer.id }, select: { userId: true } } : { take: 0, select: { userId: true } },
    },
  });
  return { colleges: colleges.map(collegeSummary) };
}

export async function getCollegeDetail(slug: string, viewer: Viewer) {
  const college = await prisma.college.findUnique({
    where: { slug },
    include: {
      listedBy: { select: { id: true, name: true, username: true } },
      _count: { select: { members: true } },
      members: {
        orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
        take: 36,
        include: {
          user: {
            select: {
              id: true, name: true, username: true, profile: { select: { avatarUrl: true, course: true, campus: true } },
              _count: { select: { followedBy: true, questions: true } },
              followedBy: viewer ? { where: { followerId: viewer.id }, select: { followerId: true } } : { take: 0, select: { followerId: true } },
            },
          },
        },
      },
    },
  });
  if (!college) return null;
  const viewerMembership = viewer ? await prisma.collegeMembership.findUnique({ where: { userId_collegeId: { userId: viewer.id, collegeId: college.id } }, select: { id: true } }) : null;
  const joined = Boolean(viewerMembership);
  return {
    ...collegeSummary({ ...college, members: joined ? [{ userId: viewer!.id }] : [] }),
    joined,
    listedBy: college.listedBy,
    students: college.members.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      username: member.user.username,
      avatarUrl: member.user.profile?.avatarUrl ?? null,
      course: member.course ?? member.user.profile?.course ?? null,
      campus: member.user.profile?.campus ?? null,
      role: member.role,
      verified: member.verified,
      followerCount: member.user._count.followedBy,
      questionCount: member.user._count.questions,
      following: member.user.followedBy.length > 0,
    })),
  };
}

export async function getStudentDirectory(viewer: Viewer, options: { q?: string; college?: string; take?: number } = {}) {
  const q = options.q?.trim();
  const where: Prisma.CollegeMembershipWhereInput = {
    user: {
      isSuspended: false,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }] } : {}),
    },
    ...(options.college ? { college: { is: { slug: options.college } } } : {}),
  };
  const members = await prisma.collegeMembership.findMany({
    where,
    take: Math.min(Math.max(options.take ?? 48, 1), 80),
    orderBy: { createdAt: "desc" },
    include: {
      college: { select: { id: true, name: true, slug: true, city: true, coverColor: true, verified: true, _count: { select: { members: true } } } },
      user: {
        select: {
          id: true, name: true, username: true, profile: { select: { avatarUrl: true, course: true, campus: true, bio: true } },
          _count: { select: { followedBy: true, questions: true } },
          followedBy: viewer ? { where: { followerId: viewer.id }, select: { followerId: true } } : { take: 0, select: { followerId: true } },
        },
      },
    },
  });
  return {
    students: members.map((member) => ({
      id: member.user.id,
      name: member.user.name,
      username: member.user.username,
      avatarUrl: member.user.profile?.avatarUrl ?? null,
      bio: member.user.profile?.bio ?? null,
      course: member.course ?? member.user.profile?.course ?? null,
      campus: member.user.profile?.campus ?? null,
      role: member.role,
      followerCount: member.user._count.followedBy,
      questionCount: member.user._count.questions,
      following: member.user.followedBy.length > 0,
      college: { ...member.college, memberCount: member.college._count.members },
    })),
  };
}

export async function createCollege(user: CurrentUser, input: { name: string; city: string; state?: string; country?: string; type?: string; website?: string; description?: string; aisheCode?: string; coverColor?: string; address?: string; buildingCount?: number | null; residentLabel?: string; latitude?: number | null; longitude?: number | null }) {
  if (input.aisheCode) {
    const existing = await prisma.college.findFirst({ where: { aisheCode: input.aisheCode }, select: { slug: true } });
    if (existing) throw new ApiError(409, "ALREADY_LISTED", "This AISHE institution already has a place listing.");
  }
  const slug = await availableSlug(input.name, input.city);
  const college = await prisma.$transaction(async (tx) => {
    const created = await tx.college.create({
      data: {
        name: input.name,
        slug,
        city: input.city,
        state: input.state || null,
        country: input.country || "India",
        type: input.type || "UNIVERSITY",
        website: input.website || null,
        description: input.description || null,
        aisheCode: input.aisheCode || null,
        directorySource: input.aisheCode ? "AISHE" : null,
        address: input.address || null,
        buildingCount: input.buildingCount ?? null,
        residentLabel: input.residentLabel || null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        coverColor: input.coverColor || colors[0],
        listedById: user.id,
      },
    });
    await tx.collegeMembership.create({ data: { collegeId: created.id, userId: user.id, role: "LISTING_ADMIN", course: user.profile?.course || null } });
    await tx.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, college: created.name, course: user.profile?.course || null },
      update: { college: created.name },
    });
    return created;
  });
  publishPublic({ type: "COLLEGE_MEMBERSHIP_CHANGED", payload: { collegeId: college.id, joined: true } });
  return { id: college.id, slug: college.slug, name: college.name };
}

export async function joinCollege(user: CurrentUser, collegeId: string, input: { course?: string; graduationYear?: number | null }) {
  const college = await prisma.college.findUnique({ where: { id: collegeId }, select: { id: true, name: true } });
  if (!college) throw new ApiError(404, "NOT_FOUND", "College not found.");
  const membership = await prisma.$transaction(async (tx) => {
    const joined = await tx.collegeMembership.upsert({
      where: { userId_collegeId: { userId: user.id, collegeId } },
      create: { userId: user.id, collegeId, role: membershipRoleFor(user), course: input.course || user.profile?.course || null, graduationYear: input.graduationYear ?? null },
      update: { ...(input.course !== undefined ? { course: input.course || null } : {}), ...(input.graduationYear !== undefined ? { graduationYear: input.graduationYear } : {}) },
    });
    await tx.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, college: college.name, course: input.course || user.profile?.course || null }, update: { college: college.name, ...(input.course ? { course: input.course } : {}) } });
    return joined;
  });
  publishPublic({ type: "COLLEGE_MEMBERSHIP_CHANGED", payload: { collegeId: membership.collegeId, joined: true } });
  return { collegeId: membership.collegeId, joined: true };
}

export async function leaveCollege(user: CurrentUser, collegeId: string) {
  const membership = await prisma.collegeMembership.findUnique({ where: { userId_collegeId: { userId: user.id, collegeId } }, include: { college: { select: { name: true } } } });
  if (!membership) return { collegeId, joined: false };
  await prisma.$transaction(async (tx) => {
    await tx.collegeMembership.delete({ where: { id: membership.id } });
    const nextMembership = await tx.collegeMembership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { college: { select: { name: true } } } });
    await tx.profile.updateMany({ where: { userId: user.id, college: membership.college.name }, data: { college: nextMembership?.college.name ?? null } });
  });
  publishPublic({ type: "COLLEGE_MEMBERSHIP_CHANGED", payload: { collegeId, joined: false } });
  return { collegeId, joined: false };
}

export async function updateCollegeLocation(user: CurrentUser, collegeId: string, input: { latitude: number; longitude: number; address?: string }) {
  const college = await prisma.college.findUnique({ where: { id: collegeId }, select: { id: true, listedById: true } });
  if (!college) throw new ApiError(404, "NOT_FOUND", "Place not found.");
  if (college.listedById !== user.id && user.role !== "ADMIN" && user.role !== "MODERATOR") throw new ApiError(403, "FORBIDDEN", "Only the person who listed this place can update its location.");
  const updated = await prisma.college.update({ where: { id: collegeId }, data: { latitude: input.latitude, longitude: input.longitude, ...(input.address ? { address: input.address } : {}) }, select: { latitude: true, longitude: true, address: true } });
  return updated;
}
