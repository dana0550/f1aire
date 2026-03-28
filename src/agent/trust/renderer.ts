import type { StrategyAnswerV1, VerificationReportV1 } from './schemas.js';

export function renderVerifiedAnswer(
  answer: StrategyAnswerV1,
  report: VerificationReportV1,
): string {
  const verifiedClaimIds = new Set(
    report.claimResults.filter((entry) => entry.ok).map((entry) => entry.claimId),
  );
  const verifiedClaims = answer.claims.filter((claim) => verifiedClaimIds.has(claim.claimId));

  const lines: string[] = [];
  lines.push(`Recommendation: ${answer.recommendation}`);
  lines.push(`Why now: ${answer.whyNow}`);

  if (answer.alternatives.length) {
    lines.push('Alternatives:');
    for (const alt of answer.alternatives) {
      lines.push(`- ${alt}`);
    }
  }

  if (answer.riskInvalidators.length) {
    lines.push('Invalidators:');
    for (const item of answer.riskInvalidators) {
      lines.push(`- ${item}`);
    }
  }

  lines.push(`Next observation window: ${answer.nextObservationWindow}`);
  if (answer.asOf) lines.push(`As of: ${answer.asOf}`);

  if (verifiedClaims.length) {
    lines.push('Verified claims:');
    for (const claim of verifiedClaims) {
      lines.push(`- ${claim.statement}`);
    }
  }

  return lines.join('\n');
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
