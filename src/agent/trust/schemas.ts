import { z } from 'zod';

export const StrategyCheckOpSchema = z.enum([
  'eq',
  'approx',
  'lt',
  'lte',
  'gt',
  'gte',
  'contains',
  'count',
  'rank',
]);

export const StrategyCheckV1Schema = z.object({
  checkId: z.string().min(1),
  toolName: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  targetPath: z.string().default(''),
  op: StrategyCheckOpSchema,
  expected: z.unknown(),
  tolerance: z.number().nonnegative().optional(),
  requiredCapability: z.string().min(1).optional(),
});

export const StrategyClaimTypeSchema = z.enum([
  'fact',
  'comparison',
  'forecast',
  'recommendation',
]);

export const StrategyClaimRoleSchema = z.enum([
  'recommendation',
  'rationale',
  'alternative',
  'invalidator',
  'observation-window',
  'evidence',
]);

export const StrategyClaimV1Schema = z.object({
  claimId: z.string().min(1),
  statement: z.string().min(1),
  claimType: StrategyClaimTypeSchema.default('fact'),
  claimRole: StrategyClaimRoleSchema.optional(),
  checks: z.array(StrategyCheckV1Schema).min(1),
  numericPayload: z.record(z.string(), z.unknown()).optional(),
});

export const StrategyRequestV1Schema = z.object({
  schemaVersion: z.literal('1').default('1'),
  question: z.string().min(1),
  asOf: z.string().nullable().optional(),
});

export const StrategyAnswerV1Schema = z.object({
  schemaVersion: z.literal('1'),
  recommendation: z.string().min(1),
  whyNow: z.string().min(1),
  alternatives: z.array(z.string()).default([]),
  riskInvalidators: z.array(z.string()).default([]),
  nextObservationWindow: z.string().min(1),
  asOf: z.string().nullable().optional(),
  claims: z.array(StrategyClaimV1Schema).min(1),
});

export const VerificationCheckResultV1Schema = z.object({
  checkId: z.string(),
  ok: z.boolean(),
  error: z.string().optional(),
  actual: z.unknown().optional(),
  expected: z.unknown().optional(),
  toolName: z.string(),
  targetPath: z.string().optional(),
});

export const VerificationClaimResultV1Schema = z.object({
  claimId: z.string(),
  ok: z.boolean(),
  checkResults: z.array(VerificationCheckResultV1Schema),
});

export const VerificationReportV1Schema = z.object({
  schemaVersion: z.literal('1'),
  ok: z.boolean(),
  claimResults: z.array(VerificationClaimResultV1Schema),
  failedCheckCount: z.number().int().nonnegative(),
  reasonCodes: z.array(z.string()),
});

export const TrustedTurnResultV1Schema = z.object({
  schemaVersion: z.literal('1'),
  mode: z.enum(['verified', 'abstained']),
  response: z.string(),
  report: VerificationReportV1Schema,
});

export type StrategyCheckOp = z.infer<typeof StrategyCheckOpSchema>;
export type StrategyCheckV1 = z.infer<typeof StrategyCheckV1Schema>;
export type StrategyClaimV1 = z.infer<typeof StrategyClaimV1Schema>;
export type StrategyClaimRole = z.infer<typeof StrategyClaimRoleSchema>;
export type StrategyRequestV1 = z.infer<typeof StrategyRequestV1Schema>;
export type StrategyAnswerV1 = z.infer<typeof StrategyAnswerV1Schema>;
export type VerificationCheckResultV1 = z.infer<typeof VerificationCheckResultV1Schema>;
export type VerificationClaimResultV1 = z.infer<typeof VerificationClaimResultV1Schema>;
export type VerificationReportV1 = z.infer<typeof VerificationReportV1Schema>;
export type TrustedTurnResultV1 = z.infer<typeof TrustedTurnResultV1Schema>;

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
    const lines = trimmed.split('\n');
    return lines.slice(1, -1).join('\n').trim();
  }
  return raw;
}

function extractFirstJSONObject(raw: string): string | null {
  const input = stripCodeFences(raw).trim();
  if (!input) return null;
  const start = input.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return input.slice(start, i + 1);
      }
    }
  }
  return null;
}

export function parseStrategyAnswerV1(raw: string): {
  ok: true;
  value: StrategyAnswerV1;
} | {
  ok: false;
  error: string;
} {
  const jsonText = extractFirstJSONObject(raw);
  if (!jsonText) {
    return { ok: false, error: 'no-json-object-found' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }

  const result = StrategyAnswerV1Schema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      ok: false,
      error: issue
        ? `schema-violation:${issue.path.join('.') || 'root'}:${issue.message}`
        : 'schema-violation',
    };
  }

  return { ok: true, value: result.data };
}
