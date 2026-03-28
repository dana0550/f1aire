---
doc_type: epic_brief
epic_id: E-001
name: Verified Strategist Hard Cutover
root_feature_id: F-002
owner: dshakiba
status: done
last_updated: 2026-03-27
---
# Epic Brief

## Vision
- Deliver the highest-confidence F1 strategist answers by emitting only replay-verified strategy conclusions or explicit abstentions.

## Outcomes
- Eliminate unverified factual claims in assistant output.
- Improve tactical quality through deterministic race-strategy metrics.
- Make trust logic evolvable through versioned rules and data adapters.
- Preserve deterministic replay behavior across identical input/session/cursor.

## User Journeys
- User asks for tactical advice and receives only verified strategy output.
- User asks in sparse-data conditions and receives abstention with actionable next query.
- Maintainer adds a new strategy rule pack and promotes it through benchmark criteria.
- Maintainer onboards a new timing topic via adapter/capability registration without changing verifier core.

## Constraints
- No feature flags, no phased rollout, no dual-path runtime.
- No user-facing citation markup in final answers.
- Hard fail-closed behavior on verification failure.
- Deterministic behavior for same input/session/cursor/rulepack version.

## Non-Goals
- Explaining internal trust traces in the end-user UI.
- Inferring truth beyond available session data fidelity.
- Preserving legacy direct-prose response path.
