import type {
  StrategyAnswerV1,
  StrategyClaimV1,
  VerificationReportV1,
} from './schemas.js';

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

  const lines: string[] = [];
  lines.push(`Recommendation: ${recommendationClaims[0]!.statement}`);
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
