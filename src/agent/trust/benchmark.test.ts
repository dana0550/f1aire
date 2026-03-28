import { describe, expect, it } from 'vitest';
import { evaluateBenchmarkSuite, type BenchmarkCase } from './benchmark.js';

describe('evaluateBenchmarkSuite', () => {
  it('computes pass rate and abstain rate against thresholds', async () => {
    const cases: BenchmarkCase[] = [
      {
        id: '1',
        expectMode: 'verified',
        run: async () => ({
          schemaVersion: '1',
          mode: 'verified',
          response: 'ok',
          report: {
            schemaVersion: '1',
            ok: true,
            claimResults: [],
            failedCheckCount: 0,
            reasonCodes: [],
          },
        }),
      },
      {
        id: '2',
        expectMode: 'verified',
        run: async () => ({
          schemaVersion: '1',
          mode: 'abstained',
          response: 'nope',
          report: {
            schemaVersion: '1',
            ok: false,
            claimResults: [],
            failedCheckCount: 1,
            reasonCodes: ['eq-mismatch'],
          },
        }),
      },
    ];

    const report = await evaluateBenchmarkSuite(cases, {
      minPassRate: 0.5,
      maxAbstainRate: 0.6,
    });

    expect(report.total).toBe(2);
    expect(report.passed).toBe(1);
    expect(report.passRate).toBe(0.5);
    expect(report.abstainRate).toBe(0.5);
    expect(report.ok).toBe(true);
  });
});
