import { describe, expect, it } from 'vitest';
import { resolveActiveRules, type RulePack } from './rulepack.js';

describe('resolveActiveRules', () => {
  it('returns only active matching rules ordered by specificity then priority', () => {
    const pack: RulePack = {
      version: '2026.1.0',
      rules: [
        {
          ruleId: 'global-low',
          description: 'global fallback',
          lifecycle: 'active',
          priority: 1,
        },
        {
          ruleId: 'season-2026-high',
          description: '2026 override',
          lifecycle: 'active',
          priority: 5,
          scope: { season: 2026 },
        },
        {
          ruleId: 'season-2026-low',
          description: '2026 low',
          lifecycle: 'active',
          priority: 2,
          scope: { season: 2026 },
        },
        {
          ruleId: 'deprecated-rule',
          description: 'deprecated',
          lifecycle: 'deprecated',
          priority: 99,
        },
      ],
    };

    const rules = resolveActiveRules(pack, { season: 2026 });
    expect(rules.map((r) => r.ruleId)).toEqual([
      'season-2026-high',
      'season-2026-low',
      'global-low',
    ]);
  });
});
