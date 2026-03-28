export type RuleLifecycle = 'candidate' | 'active' | 'deprecated' | 'removed';

export type RuleScope = {
  season?: number;
};

export type RuleDefinition = {
  ruleId: string;
  description: string;
  lifecycle: RuleLifecycle;
  priority: number;
  scope?: RuleScope;
};

export type RulePack = {
  version: string;
  rules: RuleDefinition[];
};

export type RuleContext = {
  season?: number;
};

function scopeMatches(scope: RuleScope | undefined, ctx: RuleContext): boolean {
  if (!scope) return true;
  if (scope.season !== undefined && ctx.season !== scope.season) return false;
  return true;
}

export function resolveActiveRules(pack: RulePack, ctx: RuleContext): RuleDefinition[] {
  return pack.rules
    .filter((rule) => rule.lifecycle === 'active')
    .filter((rule) => scopeMatches(rule.scope, ctx))
    .sort((a, b) => {
      const aScoped = a.scope?.season !== undefined ? 1 : 0;
      const bScoped = b.scope?.season !== undefined ? 1 : 0;
      if (aScoped !== bScoped) return bScoped - aScoped;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.ruleId.localeCompare(b.ruleId);
    });
}
