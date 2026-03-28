export type StrategyCandidate = {
  candidateId: string;
  expectedGainMs: number;
  riskPenaltyMs: number;
  executionPenaltyMs: number;
  uncertaintyPenaltyMs: number;
};

export type StrategyScore = {
  candidateId: string;
  scoreMs: number;
};

export function scoreStrategyCandidate(candidate: StrategyCandidate): StrategyScore {
  const scoreMs =
    candidate.expectedGainMs -
    candidate.riskPenaltyMs -
    candidate.executionPenaltyMs -
    candidate.uncertaintyPenaltyMs;
  return {
    candidateId: candidate.candidateId,
    scoreMs,
  };
}

export function rankStrategyCandidates(candidates: StrategyCandidate[]): StrategyScore[] {
  return candidates
    .map(scoreStrategyCandidate)
    .sort((a, b) => {
      if (a.scoreMs !== b.scoreMs) return b.scoreMs - a.scoreMs;
      return a.candidateId.localeCompare(b.candidateId);
    });
}
