import type {
  StrategyAnswerV1,
  StrategyClaimV1,
  VerificationReportV1,
} from './schemas.js';
import {
  computeDeterministicStrategyMetrics,
  rankStrategyCandidates,
} from './strategy-metrics.js';

type VerifiedRenderResult =
  | { ok: true; text: string }
  | { ok: false; reasonCodes: string[] };

function collectByRole(
  claims: StrategyClaimV1[],
  role: StrategyClaimV1['claimRole'],
): StrategyClaimV1[] {
  return claims.filter((claim) => claim.claimRole === role);
}

export function renderVerifiedAnswer(
  answer: StrategyAnswerV1,
  report: VerificationReportV1,
): VerifiedRenderResult {
  const verifiedClaimIds = new Set(
    report.claimResults.filter((entry) => entry.ok).map((entry) => entry.claimId),
  );
  const verifiedClaims = answer.claims.filter((claim) => verifiedClaimIds.has(claim.claimId));
  const recommendationClaims = collectByRole(verifiedClaims, 'recommendation');
  const rationaleClaims = collectByRole(verifiedClaims, 'rationale');
  const alternativeClaims = collectByRole(verifiedClaims, 'alternative');
  const invalidatorClaims = collectByRole(verifiedClaims, 'invalidator');
  const observationClaims = collectByRole(verifiedClaims, 'observation-window');

  const missing: string[] = [];
  if (recommendationClaims.length === 0) missing.push('missing-recommendation-claim');
  if (invalidatorClaims.length === 0) missing.push('missing-invalidator-claim');
  if (observationClaims.length === 0) missing.push('missing-observation-window-claim');
  if (missing.length > 0) {
    return { ok: false, reasonCodes: missing };
  }

  const scoredRecommendationClaims = recommendationClaims.map((claim) => {
    const payload = claim.numericPayload ?? {};
    const requiredKeys = [
      'undercutPayoffMs',
      'overcutPayoffMs',
      'trafficRejoinRiskMs',
      'drsTrainRiskMs',
      'scVscSensitivityMs',
      'executionPenaltyMs',
      'uncertaintyPenaltyMs',
    ] as const;
    for (const key of requiredKeys) {
      if (typeof payload[key] !== 'number' || !Number.isFinite(payload[key] as number)) {
        return {
          claim,
          valid: false as const,
          reason: `missing-strategy-metrics:${claim.claimId}:${key}`,
        };
      }
    }
    const metrics = computeDeterministicStrategyMetrics({
      undercutPayoffMs: payload.undercutPayoffMs as number,
      overcutPayoffMs: payload.overcutPayoffMs as number,
      trafficRejoinRiskMs: payload.trafficRejoinRiskMs as number,
      drsTrainRiskMs: payload.drsTrainRiskMs as number,
      scVscSensitivityMs: payload.scVscSensitivityMs as number,
      executionPenaltyMs: payload.executionPenaltyMs as number,
      uncertaintyPenaltyMs: payload.uncertaintyPenaltyMs as number,
    });
    return {
      claim,
      valid: true as const,
      candidate: {
        candidateId: claim.claimId,
        ...metrics,
      },
    };
  });

  const invalidMetricClaims = scoredRecommendationClaims.filter((entry) => !entry.valid);
  if (invalidMetricClaims.length > 0) {
    return {
      ok: false,
      reasonCodes: invalidMetricClaims.map((entry) => entry.reason),
    };
  }
  const validMetricClaims = scoredRecommendationClaims.filter(
    (
      entry,
    ): entry is {
      claim: StrategyClaimV1;
      valid: true;
      candidate: {
        candidateId: string;
        expectedGainMs: number;
        riskPenaltyMs: number;
        executionPenaltyMs: number;
        uncertaintyPenaltyMs: number;
      };
    } => entry.valid,
  );

  const rankedRecommendationIds = rankStrategyCandidates(
    validMetricClaims.map((entry) => entry.candidate),
  );
  const bestRecommendationId = rankedRecommendationIds[0]?.candidateId;
  const bestRecommendationClaim = recommendationClaims.find(
    (claim) => claim.claimId === bestRecommendationId,
  );
  if (!bestRecommendationClaim) {
    return { ok: false, reasonCodes: ['missing-ranked-recommendation'] };
  }

  const lines: string[] = [];
  lines.push(`Recommendation: ${bestRecommendationClaim.statement}`);
  if (rationaleClaims.length > 0) {
    lines.push('Why now:');
    for (const claim of rationaleClaims) {
      lines.push(`- ${claim.statement}`);
    }
  }
  if (alternativeClaims.length) {
    lines.push('Alternatives:');
    for (const claim of alternativeClaims) {
      lines.push(`- ${claim.statement}`);
    }
  }
  if (invalidatorClaims.length) {
    lines.push('Invalidators:');
    for (const claim of invalidatorClaims) {
      lines.push(`- ${claim.statement}`);
    }
  }
  lines.push(`Next observation window: ${observationClaims[0]!.statement}`);

  if (verifiedClaims.length) {
    lines.push('Verified claims:');
    for (const claim of verifiedClaims) {
      lines.push(`- ${claim.statement}`);
    }
  }

  return { ok: true, text: lines.join('\n') };
}

export function renderAbstention(reasonCodes: string[]): string {
  const lines: string[] = [];
  lines.push('Unable to provide a verified strategy answer for this request.');
  if (reasonCodes.length) {
    lines.push('Verification blockers:');
    for (const code of reasonCodes) {
      lines.push(`- ${code}`);
    }
  }
  lines.push('Try narrowing scope (single driver, lap range, or explicit as-of lap/time).');
  return lines.join('\n');
}
