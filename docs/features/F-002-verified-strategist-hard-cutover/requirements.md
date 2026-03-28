---
doc_type: feature_requirements
feature_id: F-002
name: Verified Strategist Hard Cutover
status: done
owner: dshakiba
last_updated: 2026-03-27
---
# Verified Strategist Hard Cutover Requirements

- R-F002-001: WHEN a user sends a strategy question, the system MUST return either a verified strategy answer or an abstention response.
- R-F002-002: IF any factual claim fails verification, the system MUST NOT emit that claim in user-visible output.
- R-F002-003: WHEN verification completes successfully, the final response MUST be rendered only from verified claim objects.
- S-F002-001: Given a verifiable strategy question When all checks pass Then the assistant returns a verified strategy answer with no provisional prose leakage.
- S-F002-002: Given a strategy question with a failing claim check When verification runs Then the assistant returns abstention with specific missing/failed reason codes.
