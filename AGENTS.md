# AGENTS.md

Guidance for coding agents working in this repository.

## Project

`ctx` is a local-first Bun/TypeScript CLI that creates context packs for coding agents. It scans repositories, stores lightweight metadata in SQLite, ranks task-relevant files, recommends tests, reports Git diff risk, and writes handoff summaries.

Keep the project deterministic. Do not add AI calls, embeddings, hosted services, background daemons, or a UI unless the user explicitly asks for a major product direction change.

## Commands

Use Bun.

```bash
bun install
bun run ctx --help
bun run check
```

Focused checks:

```bash
bun run typecheck
bun run lint
bun run format:check
bun test
bun run coverage
```

Format before finishing when files changed:

```bash
bun run format
```

## Architecture

- `src/cli/index.ts` handles argument parsing and command routing.
- `src/cli/commands/*` contains thin command wrappers.
- `src/core/*` contains the reusable implementation.
- `src/frameworks/*` contains framework-specific facades and heuristics.
- `src/types/index.ts` defines shared data shapes.
- `tests/fixtures/*` contains small Laravel and Vue fixtures.
- `tests/core.test.ts` covers the main MVP behaviours.

Prefer adding reusable logic in `src/core` and keeping command files small.

## Implementation Rules

- Use Bun native APIs where practical:
  - `bun:sqlite` for SQLite
  - `Bun.write`, `Bun.file`, and Web Crypto APIs for IO/hash work
  - `Bun.$` for Git and shell interactions
- Avoid new runtime dependencies unless they clearly remove complexity.
- Keep heuristics explicit, readable, and easy to tune.
- Prefer path/category/symbol scoring over broad content-heavy analysis.
- Do not scan dependency, generated, or build directories.
- Every recommended file or test should include a reason.
- JSON output should stay stable enough for agents to parse.

## Testing

Add or update Bun tests for behaviour changes. Use fixtures when possible instead of relying on the developer's local repositories.

Coverage is checked with:

```bash
bun run coverage
```

The coverage gate runs `bun test --coverage` through `scripts/check-coverage.ts` and requires at least 95% line coverage by default. Use focused tests for uncovered branches in `src/core` before lowering or bypassing the threshold.

Minimum expectation before handoff:

```bash
bun run check
```

If a change touches real-repo heuristics, smoke test against a real Laravel/Vue repo when available, but do not leave generated `.ctx/` directories behind in that repo.

## Style

- TypeScript is strict; keep types explicit at module boundaries.
- Keep code boring and inspectable.
- Do not over-abstract small heuristics.
- Use concise comments only where they clarify non-obvious logic.
- Keep Markdown and code formatted with `oxfmt`.

## Git

Use Conventional Commits:

```txt
feat: add context pack command
fix: improve Laravel test discovery
chore: update tooling
docs: polish README
```

Never revert unrelated user changes. Check `git status --short` before staging or committing.
