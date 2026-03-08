# Codex Ralph Loop Design

Date: 2026-03-08

## Goal
Add a repo-local `loop.sh` that repeatedly runs Codex in non-interactive YOLO mode on `main`, compares `f1aire` against `/Users/shayne/code/undercut-f1`, fixes the highest-priority remaining F1 data and API understanding gaps, verifies the change, commits it with the global git identity, and stops only when no `P0`, `P1`, or `P2` gaps remain.

## Non-Goals
- Full screen-for-screen UI parity with `undercut-f1` when the gap is only presentation.
- Replacing normal developer workflows; the loop is an aggressive local automation tool.
- Live F1 TV account login, external player sync, or other premium/live transport features unless they are required to close a top-ranked data/API gap.

## Current State (Key Observations)
- `f1aire` already knows about many official timing topics in `src/core/topic-registry.ts`, including several topics not modeled by `undercut-f1`.
- `f1aire`’s concrete processor set in `src/core/timing-service.ts` covers the classic timing feeds well, but several newer or auxiliary topics exist only as registry/data-book entries and raw inspection capability.
- `undercut-f1` remains a strong reference for typed models, replay/control surfaces, and deterministic APIs, even where it lacks newer feed coverage.
- The local Codex CLI supports scripted execution through `codex exec` and can run in explicit YOLO mode with `--dangerously-bypass-approvals-and-sandbox`.

## Proposed Approach
Use a fresh-session loop rather than a single resumed session.

Each iteration will:
1. Re-audit the current `f1aire` checkout against `/Users/shayne/code/undercut-f1`.
2. Rank remaining work as `P0`/`P1`/`P2`/`P3`.
3. Implement exactly one highest-priority `P0`/`P1`/`P2` item.
4. Run targeted verification.
5. Commit on `main`.
6. Return a machine-readable summary so the shell controller can decide whether to continue.

This keeps each iteration stateless, easier to debug, and less vulnerable to long-session drift.

## Gap Prioritization Rules
The loop should prefer concrete engineering gaps over cosmetic parity.

### `P0`
- Corrupts or misinterprets official F1 timing data.
- Causes wrong analysis conclusions from currently downloaded data.
- Breaks existing download/parse/merge/tool behavior for core feeds.

### `P1`
- Missing processors, normalization, typed modeling, or deterministic analysis surfaces for meaningful F1 feeds already known to the repo.
- Missing stable API/control/replay primitives that materially limit data usage or verification.
- Gaps where `undercut-f1` provides stronger typed or deterministic handling and `f1aire` is currently too loose or incomplete.

### `P2`
- Secondary feed support, richer topic examples, team radio workflow improvements, and non-essential but meaningful operator/API capabilities.
- Product-surface parity where it exposes a real data understanding shortfall.

### `P3`
- Pure UX polish, docs polish, or nice-to-have parity with no material data/API impact.

## Loop Controller
`loop.sh` should:

- Require execution from the repo root.
- Refuse to run outside `main`.
- Refuse to run with a dirty working tree at startup.
- Use the global git identity already configured on the machine.
- Write per-iteration artifacts to a local state directory such as `.codex-loop/`.

Per iteration it will invoke:

```bash
codex exec \
  --dangerously-bypass-approvals-and-sandbox \
  --search \
  --json \
  --output-schema <schema.json> \
  --output-last-message <final.json> \
  --cd /Users/shayne/code/f1aire \
  -
```

The prompt will be piped on stdin so the shell can version and template it cleanly.

## Machine-Readable Contract
The loop should not scrape prose. Instead it will require Codex to emit JSON matching a schema with fields like:

- `status`: `implemented` | `no_work_left` | `blocked`
- `selected_gap`
- `priority`
- `summary`
- `tests_run`
- `tests_passed`
- `commit`
- `remaining_counts`
- `blocking_reason`

The controller will continue only when:
- `status == "implemented"` and the commit exists, or
- stop successfully when `status == "no_work_left"` and all `P0`/`P1`/`P2` counts are zero.

Any other result is a hard failure.

## Prompt Contract
Each Codex iteration should be instructed to:

1. Compare `f1aire` with `/Users/shayne/code/undercut-f1`.
2. Focus on F1 data usage and understanding:
   - feed/topic definitions
   - parsing and normalization
   - processors and typed models
   - deterministic analysis tools and APIs
   - replay/control primitives
   - team radio and related data workflows
3. Prefer fixing one highest-priority issue rather than making broad unrelated edits.
4. Run verification before claiming success.
5. Commit on `main` using the current global git identity.
6. Return only the required final JSON object.

## Safety Boundaries
The loop is intentionally aggressive, but it still needs constraints:

- Never rewrite history.
- Never reset or discard unrelated working tree changes.
- Never switch branches.
- Keep each iteration scoped to one top-ranked issue.
- Fail loudly if verification or commit steps do not complete.

## Testing Strategy
The loop itself should be testable at two levels:

1. Unit-style shell validation:
   - branch guard
   - clean-tree guard
   - schema/result validation
   - stop/continue behavior
2. Real dry-run behavior:
   - support a mode that prints the prompt and command without executing Codex
   - support a max-iteration cap to avoid runaway automation

## Expected First-Class Backlog Areas
Based on the current repo comparison, early iterations are most likely to target:

- Missing processor coverage for known topics such as `TimingDataF1`, `TyreStintSeries`, `CurrentTyres`, `LapSeries`, `WeatherDataSeries`, `DriverRaceInfo`, and `OvertakeSeries`.
- Stronger concrete runtime models around timing/car/position-related data.
- Deterministic API/control or replay-oriented surfaces where `undercut-f1` is materially ahead.
- Richer TeamRadio handling when it improves data usage rather than just UI.

## Risks
- YOLO mode can make destructive mistakes if the prompt contract is weak, so the loop must validate branch, cleanliness, JSON output, and commit presence.
- “No remaining P0/P1/P2” is partly judgment-based. The schema and rubric reduce ambiguity, but the loop still depends on Codex’s ranking discipline.
- Some gaps in `undercut-f1` are reference limitations, not parity targets; the prompt must treat it as a comparison baseline, not a perfect spec.
