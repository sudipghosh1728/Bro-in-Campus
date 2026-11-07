import assert from "node:assert/strict";
import test from "node:test";
import { learningMilestones, progressSummary, scoreForDepartment } from "../lib/learning-paths";
import { learningProgressSchema, collegeDepartmentsSchema } from "../lib/validation";

const first = { title: "Learn the basics", outcome: "Build a working example" };
const second = { title: "Share your project", outcome: "Write about what you learned" };

test("milestone keys are deterministic, unique and independent of order", () => {
  const original = learningMilestones([first, second]);
  const reordered = learningMilestones([second, first, first, null, {}, { title: " " }, "junk"]);
  assert.equal(reordered.length, 2);
  assert.equal(original[0].id, reordered[1].id);
  assert.match(original[0].id, /^[a-f0-9]{24}$/);
  assert.notEqual(original[0].id, learningMilestones([{ ...first, outcome: "A revised outcome" }])[0].id);
  assert.deepEqual(learningMilestones(null), []);
});

test("progress is derived from current milestones; stale keys do not count", () => {
  const milestones = learningMilestones([first, second]);
  const record = { completedMilestones: [milestones[0].id, milestones[0].id, "stale"], startedAt: new Date("2026-01-01"), completedAt: new Date("2026-01-02") };
  assert.deepEqual(progressSummary(record, milestones), {
    completedMilestones: [milestones[0].id], progress: 50, startedAt: record.startedAt.toISOString(), completedAt: null,
  });
  assert.equal(progressSummary({ ...record, completedMilestones: milestones.map((m) => m.id) }, milestones)?.completedAt, record.completedAt.toISOString());
  assert.equal(progressSummary(record, [])?.progress, 0);
  assert.equal(progressSummary(null, milestones), null);
});

test("department matching uses whole words and does not cross profile fields", () => {
  assert.equal(scoreForDepartment("computing-ai", { course: "Hospitality and retail", interests: ["painting"] }), 0);
  assert.equal(scoreForDepartment("computing-ai", { course: "B.Tech (Computer Science)", interests: ["AI"] }), 6);
  assert.equal(scoreForDepartment("computing-ai", { course: "Information", interests: ["Technology"] }), 0);
  assert.equal(scoreForDepartment("core-engineering", { course: "Civil engineering", interests: [] }), 6);
  assert.equal(scoreForDepartment("computing-ai", null), 0);
});

test("progress and department validators reject tampered or oversized input", () => {
  const [milestone] = learningMilestones([first]);
  assert.ok(learningProgressSchema.safeParse({ completedMilestones: [milestone.id] }).success);
  assert.ok(learningProgressSchema.safeParse({ completedMilestones: [] }).success);
  for (const input of [{ progress: 100 }, { completedMilestones: [], userId: "someone-else" }, { completedMilestones: ["unknown"] }, { completedMilestones: Array(101).fill(milestone.id) }]) {
    assert.equal(learningProgressSchema.safeParse(input).success, false);
  }
  assert.ok(collegeDepartmentsSchema.safeParse({ departmentSlugs: [] }).success);
  assert.equal(collegeDepartmentsSchema.safeParse({ departmentSlugs: [], listedById: "other-user" }).success, false);
});
