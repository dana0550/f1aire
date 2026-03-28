import type { TrustedTurnResultV1 } from './schemas.js';

export type BenchmarkCase = {
  id: string;
  run: () => Promise<TrustedTurnResultV1>;
  expectMode: 'verified' | 'abstained';
};

export type BenchmarkThresholds = {
  minPassRate: number;
  maxAbstainRate: number;
  requireZeroFalseClaims?: boolean;
};

export type BenchmarkCaseResult = {
  id: string;
  pass: boolean;
  mode: 'verified' | 'abstained';
};

export type BenchmarkReport = {
  total: number;
  passed: number;
  passRate: number;
  abstainRate: number;
  falseClaimCount: number;
  ok: boolean;
  caseResults: BenchmarkCaseResult[];
};

export async function evaluateBenchmarkSuite(
  cases: BenchmarkCase[],
  thresholds: BenchmarkThresholds,
): Promise<BenchmarkReport> {
  const caseResults: BenchmarkCaseResult[] = [];

  for (const entry of cases) {
    const result = await entry.run();
    caseResults.push({
      id: entry.id,
      pass: result.mode === entry.expectMode,
      mode: result.mode,
    });
  }

  const total = caseResults.length;
  const passed = caseResults.filter((entry) => entry.pass).length;
  const abstained = caseResults.filter((entry) => entry.mode === 'abstained').length;
  const falseClaimCount = cases.reduce((count, entry, idx) => {
    const result = caseResults[idx];
    if (!result) return count;
    // A "verified" mode outcome that is not an expected pass is treated as false-claim risk.
    if (result.mode === 'verified' && !result.pass) return count + 1;
    return count;
  }, 0);
  const passRate = total > 0 ? passed / total : 1;
  const abstainRate = total > 0 ? abstained / total : 0;
  const requireZeroFalseClaims = thresholds.requireZeroFalseClaims ?? true;
  const ok =
    passRate >= thresholds.minPassRate &&
    abstainRate <= thresholds.maxAbstainRate &&
    (!requireZeroFalseClaims || falseClaimCount === 0);

  return {
    total,
    passed,
    passRate,
    abstainRate,
    falseClaimCount,
    ok,
    caseResults,
  };
}
