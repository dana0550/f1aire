# f1aire

**A terminal-native F1 race engineer.**

`f1aire` lets you load official Formula 1 live timing feeds, then ask an AI engineer questions grounded in the downloaded session data: stint deltas, gaps, safety car phases, pit windows, and more. It also supports sandboxed Python (Pyodide) for custom calculations.

This README is intentionally clear, fast to scan, and complete enough to get productive in minutes.

## Why This Project Feels Solid

- Clear UX: pick season -> meeting -> session -> chat.
- Real data: built around official live timing feeds.
- Practical AI: answers are tied to loaded session context.
- Engineerable: strict TypeScript, tests, linting, and reproducible scripts.
- Open-source friendly: transparent structure, straightforward commands, and no hidden setup steps.

## Quick Start

Run the latest version without cloning:

```bash
npx -y f1aire@latest
```

Requirements:

- Node `>= 24.13.0`
- OpenAI API key via `OPENAI_API_KEY` or in-app settings prompt

## What It Does

1. Choose season, Grand Prix, and session from the terminal UI.
2. Download and parse session timing streams.
3. Open engineer chat with an initial summary.
4. Ask analytical race questions in plain language.
5. Optionally run Python-assisted analysis safely in the Pyodide sandbox.

Example prompts:

- `Compare Norris vs Verstappen on clean laps 10-25.`
- `What was the undercut window vs car #1? Assume 20.5s pit loss.`
- `As of lap 35, who is gaining the most on average?`

## Configuration

```bash
export OPENAI_API_KEY=...
# Optional (defaults to gpt-5.2-codex)
export OPENAI_API_MODEL=...
```

API key options:

- Environment variable (`OPENAI_API_KEY`)
- In-app settings (`s` on selection screens) or prompt flow after download

## Usage Controls

- Global navigation: Enter select, `b`/Backspace/Esc back, `q` quit
- Chat: Enter send, PgUp/PgDn scroll, Esc back, Ctrl+C quit

## Development

Install toolchain and dependencies:

```bash
mise install
npm install
```

Run in dev mode:

```bash
mise run dev
# or
npm run dev
```

Build:

```bash
npm run build
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm test
```

Optional e2e streaming test (uses OpenAI API, incurs cost):

```bash
npm run test:e2e
```

## Data & Runtime Footprint

Session data is stored outside the repo under the app data directory (`f1aire/data`).

- macOS/Linux:
  - `$XDG_DATA_HOME/f1aire/data` (if set)
  - `~/.local/share/f1aire/data` (fallback)
- Windows:
  - `%LOCALAPPDATA%\f1aire\data` (preferred)
  - `%APPDATA%\f1aire\data` (fallback)
  - `%USERPROFILE%\AppData\Local\f1aire\data` (final fallback)

Notes:

- Downloads come from `livetiming.formula1.com`.
- Session folders are reused if already complete.
- Partial folders are rejected for safety.
- First run downloads Pyodide runtime assets (~200MB), then reuses cache.

## Repository Quality Signals

- Typed codebase (TypeScript, ESM)
- Colocated unit tests with Vitest
- TUI tests via `ink-testing-library`
- Linting (`eslint`) + formatting (`prettier`)
- Clear module boundaries (`src/core`, `src/tui`, `src/agent`)

If you value disciplined, inspectable open-source software, this repo is built for that standard.

## Contributing

Issues and pull requests are welcome.

A strong PR includes:

1. What changed and why
2. Reproduction steps (when fixing a bug)
3. Test evidence (for example: `npm test`, targeted test output, or screenshots for TUI changes)

Conventions:

- Conventional Commit style (`feat:`, `fix:`, `docs:`, `chore:`, `ux:`)
- Keep changes focused and easy to review

## Maintainer Automation (Advanced)

`loop.sh` is a high-autonomy maintenance script intended for power users and maintainers.

```bash
./loop.sh --dry-run --max-iterations 1
```

Use `--dry-run` first to inspect generated commands before execution.
