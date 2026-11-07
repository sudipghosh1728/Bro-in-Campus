import assert from "node:assert/strict";
import test from "node:test";
import { evaluateConsensus } from "../lib/consensus-policy";
import { campusProposalSchema, campusVoteSchema } from "../lib/consensus-validation";

test("60 of 100 votes wins; 40 of 100 does not", () => {
  assert.deepEqual(evaluateConsensus([{ id: "a", votes: 40 }, { id: "b", votes: 60 }]), { totalVotes: 100, winnerId: "b", status: "MAJORITY" });
});

test("ties, plurality and fewer than three voters cannot replace a result", () => {
  for (const votes of [[50, 50], [40, 30, 30], [1], [2]]) {
    assert.equal(evaluateConsensus(votes.map((votes, index) => ({ id: String(index), votes }))).winnerId, null);
  }
  assert.equal(evaluateConsensus([{ id: "a", votes: 2 }, { id: "b", votes: 1 }]).winnerId, "a");
  assert.equal(evaluateConsensus([]).status, "COLLECTING");
});

test("locations validate ranges and normalize duplicate coordinate precision", () => {
  const input = { kind: "LOCATION", latitude: 22.123456, longitude: 88.123456, address: "Campus main entrance" };
  assert.equal((campusProposalSchema.parse(input) as { latitude: number }).latitude, 22.1235);
  for (const payload of [{ ...input, latitude: 100 }, { ...input, longitude: -200 }, { ...input, userId: "spoof" }]) {
    assert.equal(campusProposalSchema.safeParse(payload).success, false);
  }
});

test("placement scope requires consecutive academic years and a safe source URL", () => {
  const input = { kind: "PLACEMENT", company: "Example Company", academicYear: "2026-27", status: "ANNOUNCED", departments: "CSE, IT", eligibility: "Final-year students with project experience", sourceUrl: "https://example.org/notice" };
  assert.ok(campusProposalSchema.safeParse(input).success);
  for (const payload of [{ ...input, academicYear: "2026-29" }, { ...input, sourceUrl: "javascript:alert(1)" }, { ...input, sourceUrl: "https://user:pass@example.org" }, { ...input, sourceUrl: "" }]) {
    assert.equal(campusProposalSchema.safeParse(payload).success, false);
  }
  assert.equal(campusVoteSchema.safeParse({ decisionId: "0".repeat(24), proposalId: null, votes: 60 }).success, false);
});
