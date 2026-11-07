export type LocationProposal = { kind: "LOCATION"; latitude: number; longitude: number; address: string };
export type PlacementProposal = {
  kind: "PLACEMENT"; company: string; academicYear: string; status: "EXPECTED" | "ANNOUNCED" | "COMPLETED" | "CANCELLED";
  departments: string; eligibility: string; sourceUrl: string;
};
export type CampusProposalInput = LocationProposal | PlacementProposal;
export type CampusDecisionSummary = {
  id: string; kind: string; title: string; acceptedProposalId: string | null; acceptedAt: string | null;
  totalVotes: number; winnerId: string | null; status: "MAJORITY" | "COLLECTING" | "NO_MAJORITY";
  myVote: string | null;
  proposals: { id: string; payload: CampusProposalInput; votes: number; share: number }[];
};
export type ConsensusBoard = {
  decisions: CampusDecisionSummary[];
  location: { latitude: number | null; longitude: number | null; address: string | null };
};
