import { describe, expect, it } from 'vitest';
import { rankStrategyCandidates, scoreStrategyCandidate } from './strategy-metrics.js';

describe('strategy metrics', () => {
  it('scores candidate as gain minus penalties', () => {
    const score = scoreStrategyCandidate({
      candidateId: 'pit-now',
      expectedGainMs: 1500,
      riskPenaltyMs: 300,
      executionPenaltyMs: 100,
      uncertaintyPenaltyMs: 50,
    });
    expect(score).toEqual({ candidateId: 'pit-now', scoreMs: 1050 });
  });

  it('ranks candidates by descending score with stable tie-break', () => {
    const ranked = rankStrategyCandidates([
      {
        candidateId: 'b',
        expectedGainMs: 1000,
        riskPenaltyMs: 100,
        executionPenaltyMs: 0,
        uncertaintyPenaltyMs: 0,
      },
      {
        candidateId: 'a',
        expectedGainMs: 1000,
        riskPenaltyMs: 100,
        executionPenaltyMs: 0,
        uncertaintyPenaltyMs: 0,
      },
      {
        candidateId: 'c',
        expectedGainMs: 950,
        riskPenaltyMs: 100,
        executionPenaltyMs: 0,
        uncertaintyPenaltyMs: 0,
      },
    ]);

    expect(ranked.map((r) => r.candidateId)).toEqual(['a', 'b', 'c']);
  });
});
