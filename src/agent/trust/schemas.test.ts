import { describe, expect, it } from 'vitest';
import { parseStrategyAnswerV1 } from './schemas.js';

const VALID_JSON = JSON.stringify({
  schemaVersion: '1',
  recommendation: 'Pit now',
  whyNow: 'Undercut window open',
  alternatives: ['Stay out'],
  riskInvalidators: ['VSC'],
  nextObservationWindow: 'Next lap',
  asOf: 'Lap 12',
  claims: [
    {
      claimId: 'C-1',
      statement: 'Undercut delta is positive',
      claimType: 'fact',
      checks: [
        {
          checkId: 'K-1',
          toolName: 'get_metric',
          args: {},
          targetPath: 'value',
          op: 'eq',
          expected: 1,
        },
      ],
    },
  ],
});

describe('parseStrategyAnswerV1', () => {
  it('parses the first JSON object from fenced text', () => {
    const raw = `\n\`\`\`json\n${VALID_JSON}\n\`\`\``;
    const parsed = parseStrategyAnswerV1(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.recommendation).toBe('Pit now');
    expect(parsed.value.claims).toHaveLength(1);
  });

  it('returns no-json-object-found when no JSON object exists', () => {
    const parsed = parseStrategyAnswerV1('not json');
    expect(parsed).toEqual({ ok: false, error: 'no-json-object-found' });
  });

  it('returns invalid-json for malformed object', () => {
    const parsed = parseStrategyAnswerV1('{"schemaVersion":"1",}');
    expect(parsed).toEqual({ ok: false, error: 'invalid-json' });
  });

  it('returns schema-violation for invalid schema', () => {
    const parsed = parseStrategyAnswerV1('{"schemaVersion":"1"}');
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.error).toContain('schema-violation');
  });
});
