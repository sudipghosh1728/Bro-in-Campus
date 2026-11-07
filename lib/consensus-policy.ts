export const CONSENSUS_MIN_VOTERS = 3;

export function evaluateConsensus(proposals: { id: string; votes: number }[]) {
  const totalVotes = proposals.reduce((sum, proposal) => sum + proposal.votes, 0);
  const leader = [...proposals].sort((a, b) => b.votes - a.votes)[0];
  const winnerId = totalVotes >= CONSENSUS_MIN_VOTERS && leader && leader.votes * 2 > totalVotes ? leader.id : null;
  return { totalVotes, winnerId, status: winnerId ? "MAJORITY" as const : totalVotes < CONSENSUS_MIN_VOTERS ? "COLLECTING" as const : "NO_MAJORITY" as const };
}
