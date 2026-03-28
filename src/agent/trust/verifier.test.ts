import { describe, expect, it } from 'vitest';
import { verifyStrategyAnswer } from './verifier.js';
import type { StrategyAnswerV1 } from './schemas.js';

function makeAnswer(checks: StrategyAnswerV1['claims'][number]['checks']): StrategyAnswerV1 {
  return {
    schemaVersion: '1',
    recommendation: 'Pit now',
    whyNow: 'Window open',
    alternatives: [],
    riskInvalidators: ['VSC'],
    nextObservationWindow: '1 lap',
    claims: [
      {
        claimId: 'C-1',
        statement: 'Undercut delta supports pit',
        claimType: 'fact',
        checks,
      },
    ],
  };
}

describe('verifyStrategyAnswer', () => {
  it('passes when all checks pass', async () => {
    const answer = makeAnswer([
      {
        checkId: 'K-1',
        toolName: 'get_metric',
        args: { metric: 'delta' },
        targetPath: 'value',
        op: 'eq',
        expected: 1,
      },
      {
        checkId: 'K-2',
        toolName: 'get_metric',
        args: { metric: 'delta' },
        targetPath: 'value',
        op: 'approx',
        expected: 1.1,
        tolerance: 0.2,
      },
    ]);

    const report = await verifyStrategyAnswer(answer, {
      get_metric: {
        execute: async () => ({ value: 1 }),
      },
    } as any);

    expect(report.ok).toBe(true);
    expect(report.failedCheckCount).toBe(0);
    expect(report.claimResults[0]?.ok).toBe(true);
  });

  it('fails when capability is missing', async () => {
    const answer = makeAnswer([
      {
        checkId: 'K-1',
        toolName: 'get_metric',
        args: {},
        targetPath: 'value',
        op: 'eq',
        expected: 1,
        requiredCapability: 'timing-data-fresh',
      },
    ]);

    const report = await verifyStrategyAnswer(
      answer,
      {
        get_metric: {
          execute: async () => ({ value: 1 }),
        },
      } as any,
      { availableCapabilities: new Set(['other-capability']) },
    );

    expect(report.ok).toBe(false);
    expect(report.reasonCodes).toContain('missing-capability:timing-data-fresh');
  });

  it('fails if run_py is used as final verification tool', async () => {
    const answer = makeAnswer([
      {
        checkId: 'K-1',
        toolName: 'run_py',
        args: { code: '1+1' },
        targetPath: 'value',
        op: 'eq',
        expected: 2,
      },
    ]);

    const report = await verifyStrategyAnswer(answer, {} as any);

    expect(report.ok).toBe(false);
    expect(report.reasonCodes).toContain('disallowed-tool:run_py');
  });
});
