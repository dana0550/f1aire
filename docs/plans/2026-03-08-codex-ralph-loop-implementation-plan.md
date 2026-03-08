# Codex Ralph Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a repo-local `loop.sh` that runs Codex in YOLO mode, repeatedly audits `f1aire` against `/Users/shayne/code/undercut-f1`, fixes one highest-priority `P0`/`P1`/`P2` gap per iteration, verifies the change, commits on `main`, and stops only when no `P0`/`P1`/`P2` work remains.

**Architecture:** Keep `loop.sh` as the user-facing entrypoint, but put the hard-to-test orchestration in a TypeScript helper under `scripts/`. Track the JSON output schema as a checked-in file, generate the Codex prompt deterministically, validate iteration results before continuing, and support a dry-run/max-iterations mode for safer local use.

**Tech Stack:** Bash, TypeScript, Node.js child_process/fs/path, Vitest, Codex CLI.

---

### Task 1: Add a Testable Codex Loop Helper

**Files:**
- Create: `scripts/codex-loop.ts`
- Create: `scripts/codex-loop.test.ts`

**Step 1: Write the failing tests**

Add tests covering the helper’s core decisions:
- builds a Codex command that includes `--dangerously-bypass-approvals-and-sandbox`
- stops when a parsed result reports `status: "no_work_left"` and zero `P0`/`P1`/`P2`
- continues when a parsed result reports `status: "implemented"`
- rejects invalid result objects (missing commit for `implemented`, nonzero `P0`/`P1`/`P2` for `no_work_left`)

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- scripts/codex-loop.test.ts
```
Expected: FAIL because the helper module does not exist yet.

**Step 3: Implement the minimal helper**

Create `scripts/codex-loop.ts` with:
- argument parsing for `--dry-run` and `--max-iterations`
- command construction for `codex exec --dangerously-bypass-approvals-and-sandbox --search --json --output-schema ...`
- prompt rendering for the repo audit/fix contract
- JSON result validation and stop/continue logic

Export the pure functions used by tests.

**Step 4: Run test to verify it passes**

Run:
```bash
npm test -- scripts/codex-loop.test.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/codex-loop.ts scripts/codex-loop.test.ts
git commit -m "feat: add codex loop helper"
```

---

### Task 2: Add the Checked-In Schema and Prompt Contract

**Files:**
- Create: `scripts/codex-loop-output.schema.json`
- Modify: `scripts/codex-loop.ts`
- Modify: `scripts/codex-loop.test.ts`

**Step 1: Write the failing test**

Extend the helper test to assert:
- the command points at `scripts/codex-loop-output.schema.json`
- the rendered prompt mentions `/Users/shayne/code/undercut-f1`
- the rendered prompt instructs Codex to fix exactly one highest-priority `P0`/`P1`/`P2` item and commit on `main`

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- scripts/codex-loop.test.ts
```
Expected: FAIL because the schema file and prompt content are not wired yet.

**Step 3: Implement the schema and prompt**

Add `scripts/codex-loop-output.schema.json` requiring:
- `status`
- `selected_gap`
- `priority`
- `summary`
- `tests_run`
- `tests_passed`
- `commit`
- `remaining_counts`
- `blocking_reason`

Update `scripts/codex-loop.ts` to load this schema path and render the final prompt contract.

**Step 4: Run test to verify it passes**

Run:
```bash
npm test -- scripts/codex-loop.test.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/codex-loop-output.schema.json scripts/codex-loop.ts scripts/codex-loop.test.ts
git commit -m "feat: add codex loop result schema"
```

---

### Task 3: Add Repo Safety Guards and Iteration Logging

**Files:**
- Modify: `scripts/codex-loop.ts`
- Modify: `.gitignore`
- Modify: `scripts/codex-loop.test.ts`

**Step 1: Write the failing test**

Extend tests to cover:
- rejects when not on `main`
- rejects when the working tree is dirty at startup
- creates/logs iteration artifact paths under `.codex-loop/`
- respects `--max-iterations`

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- scripts/codex-loop.test.ts
```
Expected: FAIL because the guard and logging behavior is not implemented yet.

**Step 3: Implement the guards and logging**

Update `scripts/codex-loop.ts` to:
- shell out to `git branch --show-current` and `git status --porcelain`
- fail unless branch is exactly `main` and the tree is clean
- create `.codex-loop/iteration-<n>/` logs for prompt, JSONL output, and final message
- stop with an error when the max iteration cap is hit before closure

Add `.codex-loop/` to `.gitignore`.

**Step 4: Run test to verify it passes**

Run:
```bash
npm test -- scripts/codex-loop.test.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/codex-loop.ts scripts/codex-loop.test.ts .gitignore
git commit -m "feat: add codex loop safety guards"
```

---

### Task 4: Add the User-Facing `loop.sh` Entry Point

**Files:**
- Create: `loop.sh`
- Modify: `README.md`

**Step 1: Write the failing test**

Add or extend tests to assert the helper exposes the command line contract needed by the shell wrapper:
- dry-run mode
- max-iteration mode
- repo-root execution

For the shell wrapper itself, use `bash -n loop.sh` as the syntax check.

**Step 2: Run test to verify it fails**

Run:
```bash
bash -n loop.sh
```
Expected: FAIL because `loop.sh` does not exist yet.

**Step 3: Implement `loop.sh`**

Create `loop.sh` that:
- resolves the repo root from its own location
- runs from the repo root
- invokes the TypeScript helper with the local `tsx` binary
- forwards CLI args (`--dry-run`, `--max-iterations`, future flags)
- exits nonzero on helper failure

Update `README.md` with a short section describing:
- what the loop does
- that it runs Codex in YOLO mode
- that it commits directly on `main`
- the recommended dry-run invocation

**Step 4: Run test to verify it passes**

Run:
```bash
bash -n loop.sh
npm test -- scripts/codex-loop.test.ts
```
Expected: PASS.

**Step 5: Commit**

```bash
git add loop.sh README.md scripts/codex-loop.ts scripts/codex-loop.test.ts
git commit -m "feat: add codex ralph loop entrypoint"
```

---

### Task 5: Verify the Real End-to-End Dry Run

**Files:**
- Modify: `scripts/codex-loop.ts` (only if verification uncovers a bug)
- Modify: `loop.sh` (only if verification uncovers a bug)

**Step 1: Run the real dry run**

Run:
```bash
./loop.sh --dry-run --max-iterations 1
```
Expected:
- prints the rendered prompt and Codex command
- includes `--dangerously-bypass-approvals-and-sandbox`
- points at `/Users/shayne/code/undercut-f1`
- does not execute Codex

**Step 2: Fix any bugs found**

If the dry run output is wrong, make the minimal code change needed.

**Step 3: Run full verification**

Run:
```bash
bash -n loop.sh
npm test -- scripts/codex-loop.test.ts
npm run typecheck
./loop.sh --dry-run --max-iterations 1
```
Expected: all commands PASS.

**Step 4: Commit**

```bash
git add loop.sh README.md scripts/codex-loop.ts scripts/codex-loop.test.ts .gitignore
git commit -m "fix: finalize codex ralph loop verification"
```
