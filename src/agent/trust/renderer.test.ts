import { describe, expect, it } from 'vitest';
import { renderAbstention, renderVerifiedAnswer } from './renderer.js';
import type { StrategyAnswerV1, VerificationReportV1 } from './schemas.js';

const answer: StrategyAnswerV1 = {
  schemaVersion: '1',
  recommendation: 'Pit now',
  whyNow: 'Clear air window',
  alternatives: ['Stay out'],
  riskInvalidators: ['VSC'],
  nextObservationWindow: '2 laps',
  claims: [
    {
      claimId: 'C-1',
      statement: 'Undercut pays ~1.5s',
      claimType: 'fact',
      checks: [
        {
          checkId: 'K-1',
          toolName: 'x',
          args: {},
          targetPath: 'value',
          op: 'eq',
          expected: 1,
        },
      ],
    },
    {
      claimId: 'C-2',
      statement: 'Traffic risk is low',
      claimType: 'fact',
      checks: [
        {
          checkId: 'K-2',
          toolName: 'x',
          args: {},
          targetPath: 'value',
          op: 'eq',
          expected: 1,
        },
      ],
    },
  ],
};

const report: VerificationReportV1 = {
  schemaVersion: '1',
  ok: false,
  failedCheckCount: 1,
  reasonCodes: ['eq-mismatch'],
  claimResults: [
    {
      claimId: 'C-1',
      ok: true,
      checkResults: [],
    },
    {
      claimId: 'C-2',
      ok: false,
      checkResults: [],
    },
  ],
};

describe('renderer', () => {
  it('renders only verified claims in final answer', () => {
    const text = renderVerifiedAnswer(answer, report);
    expect(text).toContain('Recommendation: Pit now');
    expect(text).toContain('- Undercut pays ~1.5s');
    expect(text).not.toContain('- Traffic risk is low');
  });

  it('renders abstention with reason codes', () => {
    const text = renderAbstention(['eq-mismatch']);
    expect(text).toContain('Unable to provide a verified strategy answer for this request.');
    expect(text).toContain('- eq-mismatch');
  });
});
