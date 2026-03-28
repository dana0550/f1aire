import type { TrustedTurnResultV1 } from './schemas.js';

export type BenchmarkCase = {
  id: string;
  run: () => Promise<TrustedTurnResultV1>;
  expectMode: 'verified' | 'abstained';
};

export type BenchmarkThresholds = {
  minPassRate: number;
  maxAbstainRate: number;
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
  const passRate = total > 0 ? passed / total : 1;
  const abstainRate = total > 0 ? abstained / total : 0;
  const ok =
    passRate >= thresholds.minPassRate &&
    abstainRate <= thresholds.maxAbstainRate;

  return {
    total,
    passed,
    passRate,
    abstainRate,
    ok,
    caseResults,
  };
}
