import type { ToolSet } from 'ai';
import {
  type StrategyAnswerV1,
  type StrategyCheckOp,
  type StrategyCheckV1,
  type VerificationCheckResultV1,
  type VerificationClaimResultV1,
  type VerificationReportV1,
} from './schemas.js';

type VerifyOptions = {
  availableCapabilities?: Set<string>;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, canonicalize(v)]);
    return Object.fromEntries(entries);
  }
  return value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

function getByPath(value: unknown, path: string): unknown {
  if (!path.trim()) return value;
  const normalized = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  let current: unknown = value;
  for (const part of normalized) {
    if (current == null) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function applyOperator(
  op: StrategyCheckOp,
  actual: unknown,
  expected: unknown,
  tolerance?: number,
): { ok: boolean; error?: string } {
  if (op === 'eq') {
    return deepEqual(actual, expected)
      ? { ok: true }
      : { ok: false, error: 'eq-mismatch' };
  }

  if (op === 'approx') {
    const lhs = asFiniteNumber(actual);
    const rhs = asFiniteNumber(expected);
    if (lhs === null || rhs === null) {
      return { ok: false, error: 'approx-non-numeric' };
    }
    const allowed = tolerance ?? 0;
    return Math.abs(lhs - rhs) <= allowed
      ? { ok: true }
      : { ok: false, error: 'approx-out-of-tolerance' };
  }

  if (op === 'lt' || op === 'lte' || op === 'gt' || op === 'gte') {
    const lhs = asFiniteNumber(actual);
    const rhs = asFiniteNumber(expected);
    if (lhs === null || rhs === null) {
      return { ok: false, error: `${op}-non-numeric` };
    }
    const pass =
      op === 'lt'
        ? lhs < rhs
        : op === 'lte'
          ? lhs <= rhs
          : op === 'gt'
            ? lhs > rhs
            : lhs >= rhs;
    return pass ? { ok: true } : { ok: false, error: `${op}-mismatch` };
  }

  if (op === 'contains') {
    if (typeof actual === 'string') {
      return typeof expected === 'string' && actual.includes(expected)
        ? { ok: true }
        : { ok: false, error: 'contains-mismatch' };
    }
    if (Array.isArray(actual)) {
      return actual.some((entry) => deepEqual(entry, expected))
        ? { ok: true }
        : { ok: false, error: 'contains-mismatch' };
    }
    if (actual && typeof actual === 'object' && typeof expected === 'string') {
      return Object.hasOwn(actual as object, expected)
        ? { ok: true }
        : { ok: false, error: 'contains-mismatch' };
    }
    return { ok: false, error: 'contains-unsupported' };
  }

  if (op === 'count') {
    const rhs = asFiniteNumber(expected);
    if (rhs === null) return { ok: false, error: 'count-expected-non-numeric' };
    const actualCount = Array.isArray(actual)
      ? actual.length
      : typeof actual === 'string'
        ? actual.length
        : actual && typeof actual === 'object'
          ? Object.keys(actual as object).length
          : null;
    if (actualCount === null) return { ok: false, error: 'count-unsupported' };
    return actualCount === rhs ? { ok: true } : { ok: false, error: 'count-mismatch' };
  }

  // rank: expected can be literal value or { value, index }
  if (op === 'rank') {
    if (!Array.isArray(actual)) return { ok: false, error: 'rank-actual-not-array' };
    const rankExpected =
      expected && typeof expected === 'object'
        ? (expected as { value?: unknown; index?: unknown })
        : { value: expected };
    const index = asFiniteNumber(rankExpected.index ?? 0);
    if (index !== null && rankExpected.value !== undefined) {
      const idx = Math.floor(index);
      if (idx < 0 || idx >= actual.length) return { ok: false, error: 'rank-index-oob' };
      return deepEqual(actual[idx], rankExpected.value)
        ? { ok: true }
        : { ok: false, error: 'rank-index-mismatch' };
    }
    if (rankExpected.value === undefined) {
      return { ok: false, error: 'rank-missing-value' };
    }
    return actual.some((entry) => deepEqual(entry, rankExpected.value))
      ? { ok: true }
      : { ok: false, error: 'rank-value-missing' };
  }

  return { ok: false, error: 'unsupported-operator' };
}

async function executeCheck(
  check: StrategyCheckV1,
  tools: ToolSet,
  opts: VerifyOptions,
): Promise<VerificationCheckResultV1> {
  if (check.requiredCapability) {
    const available = opts.availableCapabilities;
    if (available && !available.has(check.requiredCapability)) {
      return {
        checkId: check.checkId,
        ok: false,
        error: `missing-capability:${check.requiredCapability}`,
        expected: check.expected,
        toolName: check.toolName,
        targetPath: check.targetPath,
      };
    }
  }

  if (check.toolName === 'run_py') {
    return {
      checkId: check.checkId,
      ok: false,
      error: 'disallowed-tool:run_py',
      expected: check.expected,
      toolName: check.toolName,
      targetPath: check.targetPath,
    };
  }

  const toolEntry = (tools as Record<string, unknown>)[check.toolName] as
    | { execute?: (args: Record<string, unknown>) => Promise<unknown> }
    | undefined;

  if (!toolEntry || typeof toolEntry.execute !== 'function') {
    return {
      checkId: check.checkId,
      ok: false,
      error: `unknown-tool:${check.toolName}`,
      expected: check.expected,
      toolName: check.toolName,
      targetPath: check.targetPath,
    };
  }

  try {
    const args = canonicalize(check.args) as Record<string, unknown>;
    const raw = await toolEntry.execute(args);
    const actual = getByPath(raw, check.targetPath);
    const opResult = applyOperator(check.op, actual, check.expected, check.tolerance);
    return {
      checkId: check.checkId,
      ok: opResult.ok,
      error: opResult.error,
      actual,
      expected: check.expected,
      toolName: check.toolName,
      targetPath: check.targetPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      checkId: check.checkId,
      ok: false,
      error: `tool-execution-error:${message}`,
      expected: check.expected,
      toolName: check.toolName,
      targetPath: check.targetPath,
    };
  }
}

export async function verifyStrategyAnswer(
  answer: StrategyAnswerV1,
  tools: ToolSet,
  opts: VerifyOptions = {},
): Promise<VerificationReportV1> {
  const claimResults: VerificationClaimResultV1[] = [];
  const reasonCodes = new Set<string>();

  for (const claim of answer.claims) {
    const checkResults: VerificationCheckResultV1[] = [];
    for (const check of claim.checks) {
      const result = await executeCheck(check, tools, opts);
      checkResults.push(result);
      if (!result.ok && result.error) {
        reasonCodes.add(result.error);
      }
    }
    const claimOk = checkResults.every((entry) => entry.ok);
    claimResults.push({
      claimId: claim.claimId,
      ok: claimOk,
      checkResults,
    });
  }

  const failedCheckCount = claimResults.reduce((sum, claim) => {
    return sum + claim.checkResults.filter((entry) => !entry.ok).length;
  }, 0);

  const report: VerificationReportV1 = {
    schemaVersion: '1',
    ok: failedCheckCount === 0,
    claimResults,
    failedCheckCount,
    reasonCodes: Array.from(reasonCodes).sort(),
  };

  return report;
}
