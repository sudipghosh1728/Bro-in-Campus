import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { NextRequest } from "next/server";

// Never run fixtures against the configured application database. Reuse only its
// server credentials and allocate a new database, then remove that database alone.
loadEnvConfig(process.cwd());
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is required to test against a disposable MongoDB database.");
const testDatabaseName = `bic_verify_${randomBytes(8).toString("hex")}`;
const isolatedUrl = new URL(sourceUrl);
isolatedUrl.pathname = `/${testDatabaseName}`;
if (isolatedUrl.toString() === sourceUrl) throw new Error("Database isolation failed.");
process.env.DATABASE_URL = isolatedUrl.toString();
process.env.AUTH_SECRET = randomBytes(40).toString("hex");

async function main() {
  const { prisma } = await import("../lib/prisma");
  try {
    console.log(`Preparing isolated database ${testDatabaseName}; application database untouched.`);
    const push = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], {
      env: process.env, encoding: "utf8", timeout: 180000, windowsHide: true,
    });
    // Do not echo Prisma's connection details or database credentials.
    if (push.status !== 0) {
      const details = `${push.error?.message ?? ""}\n${push.stderr ?? ""}`.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[database URI redacted]");
      console.error("Isolated schema setup failed:", details);
      throw new Error("Could not initialize the isolated test database. Check database connectivity and create-database permissions.");
    }
    console.log(`Isolated test database ${testDatabaseName} initialized; application database untouched.`);

    const { createSession, getRequestUser } = await import("../lib/auth");
    const progressRoute = await import("../app/api/learning-paths/[id]/progress/route");
    const departmentRoute = await import("../app/api/colleges/[id]/departments/route");
    const { getCollegeDetail, createCollege } = await import("../lib/colleges");
    const { getGrowthOverview, loadGrowthCatalog } = await import("../lib/growth");
    const { learningMilestones } = await import("../lib/learning-paths");

    const users = await Promise.all(["owner", "student", "moderator", "suspended"].map((name) => prisma.user.create({ data: {
      name, username: name, email: `${name}@example.invalid`, passwordHash: "test-account-no-password",
      role: name === "moderator" ? "MODERATOR" : "USER", isSuspended: name === "suspended",
    } })));
    const tokens = await Promise.all(users.map(async (user) => (await createSession(user)).token));
    const request = (method: string, token?: string, body?: unknown) => new NextRequest("http://localhost/api/test", {
      method, headers: { "Content-Type": "application/json", ...(token ? { Cookie: `bic_session=${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const owner = (await getRequestUser(request("GET", tokens[0])))!;
    const dept = await prisma.department.create({ data: { name: "Computing", slug: "computing-ai", synopsis: "Test curriculum" } });
    const otherDept = await prisma.department.create({ data: { name: "Engineering", slug: "core-engineering", synopsis: "Test curriculum" } });
    const path = await prisma.learningPath.create({ data: {
      title: "Test learning plan", slug: "test-plan", departmentSlug: dept.slug, duration: "2 weeks", description: "Fixture only",
      milestones: [{ title: "Learn", outcome: "Make an example" }, { title: "Build", outcome: "Share a project" }],
    } });
    const ids = learningMilestones(path.milestones).map((milestone) => milestone.id);
    const context = { params: Promise.resolve({ id: path.id }) };
    const put = (token: string | undefined, completedMilestones: string[]) => progressRoute.PUT(request("PUT", token, { completedMilestones }), context);
    assert.equal((await put(undefined, [])).status, 401);
    assert.equal((await put(tokens[3], [])).status, 403);
    assert.equal((await progressRoute.GET(request("GET"), context)).status, 401);
    assert.equal((await progressRoute.GET(request("GET", tokens[0]), { params: Promise.resolve({ id: "invalid" }) })).status, 422);
    assert.equal((await progressRoute.GET(request("GET", tokens[0]), { params: Promise.resolve({ id: "000000000000000000000000" }) })).status, 404);
    assert.equal((await put(tokens[0], ["000000000000000000000000"])).status, 422);
    assert.equal((await progressRoute.PUT(request("PUT", tokens[0], { completedMilestones: ids, userId: users[1].id }), context)).status, 422);
    console.log("PASS progress authentication, suspension, path validation and payload tampering");

    assert.equal((await put(tokens[0], [])).status, 200);
    const saved = await put(tokens[0], [ids[0], ids[0]]);
    assert.equal(saved.status, 200);
    assert.equal(saved.headers.get("Cache-Control"), "private, no-store");
    assert.equal((await saved.json()).data.progress.progress, 50);
    let reloaded = await progressRoute.GET(request("GET", tokens[0]), context);
    assert.deepEqual((await reloaded.json()).data.progress.completedMilestones, [ids[0]]);
    const otherUser = await progressRoute.GET(request("GET", tokens[1]), context);
    assert.equal((await otherUser.json()).data.progress, null);
    assert.equal((await getGrowthOverview(null)).paths[0].progress, null);
    assert.equal((await getGrowthOverview(owner)).paths[0].progress?.progress, 50);
    assert.equal((await getGrowthOverview({ ...owner, id: users[1].id })).paths[0].progress, null);
    const sharedCatalog = loadGrowthCatalog();
    assert.ok(!JSON.stringify(await sharedCatalog).includes("completedMilestones"), "Public cache must not contain account progress");
    assert.equal((await getGrowthOverview(owner, sharedCatalog)).paths[0].progress?.progress, 50);
    assert.equal((await getGrowthOverview({ ...owner, id: users[1].id }, sharedCatalog)).paths[0].progress, null);
    const completed = (await (await put(tokens[0], ids)).json()).data.progress;
    assert.equal(completed.progress, 100);
    assert.ok(completed.completedAt);
    assert.equal((await (await put(tokens[0], ids)).json()).data.progress.completedAt, completed.completedAt);
    assert.equal((await (await put(tokens[0], [])).json()).data.progress.completedAt, null);
    const concurrent = await Promise.all([put(tokens[0], ids), put(tokens[0], ids)]);
    assert.ok(concurrent.every((response) => response.status === 200));
    assert.equal(await prisma.learningPathProgress.count(), 1);
    console.log("PASS progress reload, per-account privacy, duplicate saves, completion and concurrent saves");

    const college = await createCollege(owner, { name: "Fixture College", city: "Fixture City", type: "COLLEGE", departmentSlugs: [dept.slug, dept.slug] });
    assert.equal((await getCollegeDetail(college.slug, owner))?.departments.length, 1);
    const collegeContext = { params: Promise.resolve({ id: college.id }) };
    const departments = (token: string | undefined, departmentSlugs: string[]) => departmentRoute.PUT(request("PUT", token, { departmentSlugs }), collegeContext);
    assert.equal((await departments(undefined, [])).status, 401);
    assert.equal((await departments(tokens[1], [])).status, 403);
    assert.equal((await departments(tokens[3], [])).status, 403);
    assert.equal((await departments(tokens[0], ["not-a-department"])).status, 422);
    assert.equal((await getCollegeDetail(college.slug, owner))?.departments[0].slug, dept.slug);
    assert.equal((await departments(tokens[0], [otherDept.slug, otherDept.slug])).status, 200);
    assert.equal((await getCollegeDetail(college.slug, owner))?.departments[0].slug, otherDept.slug);
    assert.equal((await departments(tokens[2], [])).status, 200);
    assert.equal((await getCollegeDetail(college.slug, owner))?.departments.length, 0);
    const replacements = await Promise.all([departments(tokens[0], [dept.slug]), departments(tokens[0], [otherDept.slug])]);
    assert.ok(replacements.every((response) => response.status === 200));
    assert.equal((await getCollegeDetail(college.slug, owner))?.departments.length, 1);
    console.log("PASS college creation, owner/moderator permission, invalid selection rollback, replacement and concurrency");

    await prisma.learningPath.update({ where: { id: path.id }, data: { milestones: [{ title: "Revised", outcome: "A new task" }] } });
    reloaded = await progressRoute.GET(request("GET", tokens[0]), context);
    assert.equal((await reloaded.json()).data.progress.progress, 0);
    assert.equal((await put(tokens[0], ids)).status, 422);
    console.log("PASS changed curriculum invalidates stale milestones");

    const reviews = await import("../app/api/colleges/[id]/reviews/route");
    const legacyLocation = await import("../app/api/colleges/[id]/route");
    const proposalA = { kind: "LOCATION", latitude: 22.5, longitude: 88.3, address: "Campus north entrance" };
    const proposalB = { kind: "LOCATION", latitude: 22.6, longitude: 88.4, address: "Campus main entrance" };
    const propose = (token: string | undefined, payload: unknown) => reviews.POST(request("POST", token, payload), collegeContext);
    assert.equal((await propose(undefined, proposalA)).status, 401);
    assert.equal((await propose(tokens[1], proposalA)).status, 403);
    assert.equal((await propose(tokens[3], proposalA)).status, 403);
    for (const user of users.slice(1, 3)) await prisma.collegeMembership.create({ data: { collegeId: college.id, userId: user.id } });
    let response = await propose(tokens[0], proposalA);
    assert.equal(response.status, 201);
    let board = (await response.json()).data;
    assert.equal(board.location.latitude, null, "One vote must not change the map");
    const decisionId = board.decisions[0].id;
    const firstProposalId = board.decisions[0].proposals[0].id;
    board = (await (await propose(tokens[1], proposalB)).json()).data;
    const secondProposalId = board.decisions[0].proposals.find((p: { id: string }) => p.id !== firstProposalId).id;
    const vote = (token: string, proposalId: string | null) => reviews.PUT(request("PUT", token, { decisionId, proposalId }), collegeContext);
    response = await vote(tokens[2], secondProposalId);
    assert.equal(response.status, 200);
    board = (await response.json()).data;
    assert.equal(board.location.latitude, 22.6);
    assert.equal(board.decisions[0].totalVotes, 3);
    assert.equal(board.decisions[0].winnerId, secondProposalId);
    assert.equal((await vote(tokens[2], secondProposalId)).status, 200);
    assert.equal(await prisma.campusDecisionVote.count(), 3, "Repeated votes must not inflate the count");
    assert.equal((await vote(tokens[2], path.id)).status, 422, "Cannot vote for a different entity");
    assert.equal((await reviews.PUT(request("PUT", tokens[0], { decisionId, proposalId: firstProposalId, userId: users[1].id }), collegeContext)).status, 422);
    assert.equal((await legacyLocation.PATCH(request("PATCH", tokens[0], { latitude: 0, longitude: 0 }), collegeContext)).status, 409, "Legacy direct edits must not bypass consensus");
    const voter4 = await prisma.user.create({ data: { email: "fourth@example.invalid", username: "fourth", name: "Fourth", passwordHash: "no-password" } });
    await prisma.collegeMembership.create({ data: { userId: voter4.id, collegeId: college.id } });
    const token4 = (await createSession(voter4)).token;
    board = (await (await vote(token4, firstProposalId)).json()).data;
    assert.equal(board.decisions[0].status, "NO_MAJORITY");
    assert.equal(board.location.latitude, 22.6, "A tie must preserve the last accepted map");
    board = (await (await vote(tokens[1], firstProposalId)).json()).data;
    assert.equal(board.decisions[0].winnerId, firstProposalId);
    assert.equal(board.location.latitude, 22.5, "A changed majority must update the map");
    board = (await (await reviews.GET(request("GET"), collegeContext)).json()).data;
    assert.equal(board.decisions[0].myVote, null);
    const publicBoard = JSON.stringify(board);
    assert.ok(!publicBoard.includes(users[0].id) && !publicBoard.includes(users[0].email), "Public tallies must not expose voters");
    const placement = { kind: "PLACEMENT", company: "Fixture Recruiter", academicYear: "2026-27", status: "ANNOUNCED", departments: "CSE and IT", eligibility: "Final year students with project work", sourceUrl: "https://example.org/placement-notice" };
    for (const token of tokens.slice(0, 3)) assert.equal((await propose(token, placement)).status, 201);
    board = (await (await reviews.GET(request("GET", tokens[0]), collegeContext)).json()).data;
    const placementReview = board.decisions.find((d: { kind: string }) => d.kind === "PLACEMENT");
    assert.equal(placementReview.totalVotes, 3);
    assert.equal(placementReview.status, "MAJORITY");
    assert.equal(placementReview.proposals.length, 1);
    const { createImpersonationSession } = await import("../lib/auth");
    const admin = await prisma.user.create({ data: { name: "Admin", username: "test_admin", email: "admin@example.invalid", role: "ADMIN", passwordHash: "no-password" } });
    const adminSession = await createSession(admin);
    const impersonated = await createImpersonationSession(admin, owner, request("GET"), adminSession.expiresAt);
    const impersonationRequest = new NextRequest("http://localhost/api/test", { method: "POST", headers: { "Content-Type": "application/json", Cookie: `bic_session=${impersonated.token}; bic_admin_session=${adminSession.token}` }, body: JSON.stringify(proposalA) });
    assert.equal((await reviews.POST(impersonationRequest, collegeContext)).status, 403);
    console.log("PASS campus consensus: membership, quorum, majority, ties, changed votes, deduplication, anonymous tallies, placement scope and impersonation protection");

    const adminCollege = await import("../app/api/admin/colleges/[id]/route");
    assert.equal((await adminCollege.PATCH(request("PATCH", adminSession.token, { latitude: 0, longitude: 0 }), collegeContext)).status, 409, "Admin cannot bypass member location consensus");
    const adminUser = await import("../app/api/admin/users/[id]/route");
    const studentContext = { params: Promise.resolve({ id: users[1].id }) };
    assert.equal((await adminUser.PATCH(request("PATCH", adminSession.token, { isSuspended: true }), studentContext)).status, 200);
    board = (await (await reviews.GET(request("GET"), collegeContext)).json()).data;
    assert.equal(board.decisions.find((d: { kind: string }) => d.kind === "PLACEMENT").totalVotes, 2);
    assert.equal((await adminUser.PATCH(request("PATCH", adminSession.token, { isSuspended: false }), studentContext)).status, 200);
    board = (await (await reviews.GET(request("GET"), collegeContext)).json()).data;
    assert.equal(board.decisions.find((d: { kind: string }) => d.kind === "PLACEMENT").totalVotes, 3);
    console.log("PASS admin location guard and suspension vote recalculation");

    const { getDiscoverFeed } = await import("../lib/community");
    const topicA = await prisma.topic.create({ data: { name: "Fixture skills", slug: "fixture-skills" } });
    const topicB = await prisma.topic.create({ data: { name: "Fixture careers", slug: "fixture-careers" } });
    await prisma.profile.create({ data: { userId: users[1].id, college: "Other fixture college" } });
    const fixtures = await Promise.all(Array.from({ length: 12 }, (_, i) => prisma.question.create({ data: {
      title: `Fixture discussion ${i}`, slug: `fixture-${i}`, body: "Test feed only", authorId: users[i % 2].id,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
    } })));
    await prisma.question.create({ data: { title: "Removed discussion", slug: "fixture-removed", body: "Not public", authorId: users[0].id, status: "DELETED", deletedAt: new Date() } });
    await prisma.questionTopic.createMany({ data: [
      { questionId: fixtures[0].id, topicId: topicA.id }, { questionId: fixtures[1].id, topicId: topicB.id },
      { questionId: fixtures[2].id, topicId: topicA.id }, { questionId: fixtures[2].id, topicId: topicB.id },
    ] });
    await prisma.bookmark.createMany({ data: [{ userId: users[0].id, questionId: fixtures[0].id }, { userId: users[1].id, questionId: fixtures[1].id }] });
    await prisma.answer.createMany({ data: [
      { questionId: fixtures[0].id, authorId: users[1].id, body: "Visible reply" },
      { questionId: fixtures[0].id, authorId: users[1].id, body: "Removed reply", status: "DELETED", deletedAt: new Date() },
    ] });
    await prisma.questionVote.create({ data: { questionId: fixtures[0].id, userId: users[0].id } });
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 3; page++) {
      const feed = await getDiscoverFeed(owner, { take: 5, sort: "recommended", cursor, feedOnly: true });
      assert.deepEqual(feed.topics, []);
      assert.deepEqual(feed.recommendedUsers, []);
      for (const item of feed.questions) { assert.ok(!seen.has(item.id), "Pagination must not repeat ranked items"); seen.add(item.id); }
      cursor = feed.nextCursor ?? undefined;
    }
    assert.equal(seen.size, 12);
    assert.equal(cursor, undefined);
    const ownFeed = await getDiscoverFeed(owner, { feedOnly: true });
    assert.equal(ownFeed.questions.find((item) => item.id === fixtures[0].id)?.answerCount, 1);
    assert.equal(ownFeed.questions.find((item) => item.id === fixtures[0].id)?.liked, true);
    assert.equal(ownFeed.questions.find((item) => item.id === fixtures[0].id)?.bookmarked, true);
    assert.equal(ownFeed.questions.find((item) => item.id === fixtures[1].id)?.bookmarked, false);
    assert.equal(ownFeed.questions.find((item) => item.id === fixtures[1].id)?.author.college, "Other fixture college");
    assert.deepEqual(ownFeed.questions.find((item) => item.id === fixtures[0].id)?.topics.map((topic) => topic.slug), [topicA.slug]);
    assert.deepEqual(ownFeed.questions.find((item) => item.id === fixtures[2].id)?.topics.map((topic) => topic.slug).sort(), [topicA.slug, topicB.slug].sort());
    const guestFeed = await getDiscoverFeed(null, { feedOnly: true });
    assert.equal(guestFeed.questions.find((item) => item.id === fixtures[0].id)?.liked, false);
    assert.equal(guestFeed.questions.find((item) => item.id === fixtures[0].id)?.bookmarked, false);
    const filteredFeed = await getDiscoverFeed(null, { feedOnly: true, topic: topicB.slug });
    assert.deepEqual(filteredFeed.questions.map((item) => item.id).sort(), [fixtures[1].id, fixtures[2].id].sort());
    const emptyFeed = await getDiscoverFeed(null, { feedOnly: true, q: "No such fixture discussion" });
    assert.deepEqual(emptyFeed.questions, []);
    assert.equal(emptyFeed.nextCursor, null);
    console.log("PASS bounded feed pagination, author/profile/topic mapping, filtering, public counts and private likes/bookmarks");

    await prisma.notification.createMany({ data: [
      { userId: users[0].id, type: "ANSWER_CREATED", message: "Unread fixture" },
      { userId: users[0].id, type: "ANSWER_CREATED", message: "Read fixture", readAt: new Date() },
      { userId: users[1].id, type: "ANSWER_CREATED", message: "Other account fixture" },
    ] });
    const notificationRoute = await import("../app/api/notifications/route");
    const countResponse = await notificationRoute.GET(new NextRequest("http://localhost/api/notifications?count=1", { headers: { Cookie: `bic_session=${tokens[0]}` } }));
    assert.equal(countResponse.headers.get("Cache-Control"), "private, no-store");
    assert.deepEqual((await countResponse.json()).data, { unreadCount: 1 });
    console.log("PASS lightweight notification count and account isolation");
  } finally {
    // The only destructive operation targets the exact random database created above.
    if (new URL(process.env.DATABASE_URL!).pathname !== `/${testDatabaseName}` || !/^bic_verify_[a-f0-9]{16}$/.test(testDatabaseName)) {
      throw new Error("Refusing cleanup: test database identity changed.");
    }
    try {
      // Atlas application credentials often cannot drop databases. Delete only
      // fixture documents; the isolated, empty database and its indexes may remain.
      await prisma.learningPathProgress.deleteMany();
      await prisma.notification.deleteMany();
      await prisma.answer.deleteMany();
      await prisma.questionVote.deleteMany();
      await prisma.bookmark.deleteMany();
      await prisma.questionTopic.deleteMany();
      await prisma.question.deleteMany();
      await prisma.topic.deleteMany();
      await prisma.campusDecisionVote.deleteMany();
      await prisma.campusProposal.deleteMany();
      await prisma.campusDecision.deleteMany();
      await prisma.adminImpersonation.deleteMany();
      await prisma.collegeDepartment.deleteMany();
      await prisma.collegeMembership.deleteMany();
      await prisma.session.deleteMany();
      await prisma.profile.deleteMany();
      await prisma.college.deleteMany();
      await prisma.learningPath.deleteMany();
      await prisma.department.deleteMany();
      await prisma.user.deleteMany();
      console.log("Disposable test documents removed; only an empty test database may remain.");
    } finally { await prisma.$disconnect(); }
  }
}

main().catch((error) => {
  // Integration failures must never print a connection URI.
  const message = error instanceof Error ? error.message : "Unknown integration failure";
  console.error(message.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[database URI redacted]"));
  process.exitCode = 1;
});
