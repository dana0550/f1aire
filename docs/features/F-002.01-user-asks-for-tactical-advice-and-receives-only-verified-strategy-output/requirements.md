---
doc_type: feature_requirements
feature_id: F-002.01
name: User asks for tactical advice and receives only verified strategy output.
status: done
owner: dshakiba
last_updated: 2026-03-27
---
# User asks for tactical advice and receives only verified strategy output. Requirements

- R-F002.01-001: WHEN a claim is emitted, the system MUST require at least one valid deterministic check bound to that claim.
- R-F002.01-002: WHEN check replay executes, the verifier MUST use canonical tool name, canonicalized args, target path, and explicit operator semantics.
- R-F002.01-003: IF verification fails after one repair attempt, the system MUST abstain.
- S-F002.01-001: Given malformed check schema When verification starts Then the turn abstains with invalid-check reason.
- S-F002.01-002: Given operator mismatch on replay result When verification runs Then the claim fails and turn abstains.
