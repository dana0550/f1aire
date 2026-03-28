export type StrategyCandidate = {
  candidateId: string;
  expectedGainMs: number;
  riskPenaltyMs: number;
  executionPenaltyMs: number;
  uncertaintyPenaltyMs: number;
};

export type DeterministicStrategyMetricsInput = {
  undercutPayoffMs: number;
  overcutPayoffMs: number;
  trafficRejoinRiskMs: number;
  drsTrainRiskMs: number;
  scVscSensitivityMs: number;
  executionPenaltyMs: number;
  uncertaintyPenaltyMs: number;
};

export type DeterministicStrategyMetrics = {
  expectedGainMs: number;
  riskPenaltyMs: number;
  executionPenaltyMs: number;
  uncertaintyPenaltyMs: number;
};

export type StrategyScore = {
  candidateId: string;
  scoreMs: number;
};

export function computeDeterministicStrategyMetrics(
  input: DeterministicStrategyMetricsInput,
): DeterministicStrategyMetrics {
  const expectedGainMs = Math.max(input.undercutPayoffMs, input.overcutPayoffMs);
  const riskPenaltyMs =
    input.trafficRejoinRiskMs + input.drsTrainRiskMs + input.scVscSensitivityMs;
  return {
    expectedGainMs,
    riskPenaltyMs,
    executionPenaltyMs: input.executionPenaltyMs,
    uncertaintyPenaltyMs: input.uncertaintyPenaltyMs,
  };
}

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
