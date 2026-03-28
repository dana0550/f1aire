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
      claimRole: 'rationale',
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
      statement: 'Pit now',
      claimRole: 'recommendation',
      claimType: 'recommendation',
      numericPayload: {
        undercutPayoffMs: 1800,
        overcutPayoffMs: 1200,
        trafficRejoinRiskMs: 300,
        drsTrainRiskMs: 150,
        scVscSensitivityMs: 100,
        executionPenaltyMs: 75,
        uncertaintyPenaltyMs: 50,
      },
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
    {
      claimId: 'C-3',
      statement: 'VSC',
      claimRole: 'invalidator',
      claimType: 'forecast',
      checks: [
        {
          checkId: 'K-3',
          toolName: 'x',
          args: {},
          targetPath: 'value',
          op: 'eq',
          expected: 1,
        },
      ],
    },
    {
      claimId: 'C-4',
      statement: '2 laps',
      claimRole: 'observation-window',
      claimType: 'fact',
      checks: [
        {
          checkId: 'K-4',
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
      ok: true,
      checkResults: [],
    },
    {
      claimId: 'C-3',
      ok: true,
      checkResults: [],
    },
    {
      claimId: 'C-4',
      ok: true,
      checkResults: [],
    },
  ],
};

describe('renderer', () => {
  it('renders only verified claims in final answer', () => {
    const rendered = renderVerifiedAnswer(answer, report);
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const text = rendered.text;
    expect(text).toContain('Recommendation: Pit now');
    expect(text).toContain('- Undercut pays ~1.5s');
    expect(text).toContain('Invalidators:');
    expect(text).toContain('- VSC');
    expect(text).toContain('Next observation window: 2 laps');
  });

  it('renders abstention with reason codes', () => {
    const text = renderAbstention(['eq-mismatch']);
    expect(text).toContain('Unable to provide a verified strategy answer for this request.');
    expect(text).toContain('- eq-mismatch');
  });

  it('fails closed if required claim roles are missing', () => {
    const missingRoles = {
      ...answer,
      claims: [answer.claims[0]!],
    };
    const rendered = renderVerifiedAnswer(missingRoles, {
      ...report,
      claimResults: [{ claimId: 'C-1', ok: true, checkResults: [] }],
      failedCheckCount: 0,
      reasonCodes: [],
      ok: true,
    });
    expect(rendered.ok).toBe(false);
    if (rendered.ok) return;
    expect(rendered.reasonCodes).toContain('missing-recommendation-claim');
    expect(rendered.reasonCodes).toContain('missing-invalidator-claim');
    expect(rendered.reasonCodes).toContain('missing-observation-window-claim');
  });

  it('fails closed when recommendation metrics payload is missing', () => {
    const missingMetrics = {
      ...answer,
      claims: answer.claims.map((claim) =>
        claim.claimId === 'C-2'
          ? {
              ...claim,
              numericPayload: undefined,
            }
          : claim,
      ),
    };
    const rendered = renderVerifiedAnswer(missingMetrics, {
      ...report,
      ok: true,
      failedCheckCount: 0,
      reasonCodes: [],
    });
    expect(rendered.ok).toBe(false);
    if (rendered.ok) return;
    expect(rendered.reasonCodes.some((code) => code.startsWith('missing-strategy-metrics:C-2'))).toBe(true);
  });
});
