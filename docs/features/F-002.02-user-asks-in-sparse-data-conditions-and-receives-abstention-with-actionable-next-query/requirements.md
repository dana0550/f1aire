---
doc_type: feature_requirements
feature_id: F-002.02
name: User asks in sparse-data conditions and receives abstention with actionable next query.
status: done
owner: dshakiba
last_updated: 2026-03-27
---
# User asks in sparse-data conditions and receives abstention with actionable next query. Requirements

- R-F002.02-001: WHEN generating recommendations, the system MUST compute deterministic strategy metrics for undercut/overcut payoff, traffic/rejoin risk, DRS-train risk, and SC/VSC sensitivity.
- R-F002.02-002: WHEN ranking candidate actions, the system MUST apply explicit scoring across expected gain, risk penalty, execution feasibility, and robustness.
- R-F002.02-003: WHEN returning a recommendation, the answer MUST include invalidators and next observation window.
- S-F002.02-001: Given a pit-window query When metrics are available Then the selected recommendation matches best deterministic score.
- S-F002.02-002: Given uncertainty-sensitive context When recommendation is returned Then invalidators and observation window are present.
