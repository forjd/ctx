# ctx

[![CI](https://github.com/forjd/ctx/actions/workflows/ci.yml/badge.svg)](https://github.com/forjd/ctx/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@forjd/ctx)](https://www.npmjs.com/package/@forjd/ctx)
[![Coverage](https://img.shields.io/badge/coverage-95%25%2B-brightgreen)](scripts/check-coverage.ts)
[![License: MIT](https://img.shields.io/github/license/forjd/ctx)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-black?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Local First](https://img.shields.io/badge/local--first-no%20AI%20API-7c3aed)](#how-it-works)

Local context packs for coding agents.

`ctx` is a deterministic CLI that scans a repository and generates the files, tests, rules, risks, and commands an agent should inspect before editing code. It is local-first, fast, and does not call an AI API.

## Why

Coding agents are more useful when they start with the right context. `ctx` gives them a compact, task-specific brief instead of asking them to wander through a whole repository.

It can:

- detect Laravel, Vue, React, Next.js, Node, TypeScript, and Pest projects
- index important files and lightweight symbols
- infer project rules from config and docs
- rank task-relevant files with reasons
- recommend focused tests
- flag risky Git diffs
- write handoff summaries after a run

## Quick Start

Run the published Bun CLI:

```bash
bunx @forjd/ctx --help
```

Or install it globally:

```bash
bun add --global @forjd/ctx
ctx --help
```

From a source checkout:

```bash
git clone https://github.com/forjd/ctx.git
cd ctx
bun install

# Run ctx from this checkout
bun run ctx --help
```

Against another repository:

```bash
cd /path/to/your/repo
ctx init
ctx index
ctx pack "add expiry reminders for source-of-funds requests"
```

## Example

```bash
ctx pack "add retry handling for report exports"
```

Produces a Markdown context pack with:

- relevant files, each with a reason
- related tests and exact commands
- inferred project rules
- matching Git history
- risk notes
- suggested next actions

JSON output is available for agents:

```bash
ctx pack "add retry handling for report exports" --json
```

## Commands

| Command                   | Purpose                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `ctx init`                | Create `.ctx/`, SQLite storage, config, packs, and handoff directories.   |
| `ctx index`               | Scan files, extract lightweight symbols, infer rules, and store metadata. |
| `ctx map [--json]`        | Print detected stack, important directories, and conventions.             |
| `ctx pack <task>`         | Generate a task-specific context pack in Markdown or JSON.                |
| `ctx tests-for <file>`    | Recommend focused test commands for a file.                               |
| `ctx tests-for --changed` | Recommend tests for the current Git diff.                                 |
| `ctx diff-risk [--json]`  | Classify changed files and report risk signals.                           |
| `ctx rules [--json]`      | Print inferred project rules.                                             |
| `ctx explain <file>`      | Explain one indexed file's category, symbols, tests, and rules.           |
| `ctx stale [--json]`      | Report whether the saved index is stale for files, config, or Git HEAD.   |
| `ctx handoff`             | Write a Markdown handoff under `.ctx/handoffs/`.                          |

Useful options:

```bash
ctx pack "task" --json
ctx pack "task" --markdown
ctx pack "task" --output .ctx/packs/my-task.md
ctx handoff --stdout
```

Project-specific scoring can be tuned in `.ctx/config.json` with `scoring.synonyms`,
`scoring.categoryBoosts`, and `scoring.broaderTestCommands`.

## How It Works

`ctx` uses simple local heuristics:

- path-based framework and category detection
- lightweight regex symbol extraction
- keyword and synonym matching
- lightweight import/dependency edge extraction
- test filename/domain similarity
- Git diff and history inspection
- SQLite storage via `bun:sqlite`

There are no embeddings, hosted services, background daemons, or external AI calls.

## Supported Today

Best coverage:

- Laravel apps
- Vue frontends
- React and Next.js frontends
- TypeScript and JavaScript projects
- Pest/PHPUnit-style test layouts
- general Git repositories

The project remains intentionally small: a deterministic context engine that improves agent setup before code edits.

## Agent Skill

This repo includes a `ctx-context-pack` skill for agents that need a standard workflow for calling `ctx` before editing another repository.

Install it with [`bunx skills`](https://skills.sh/):

```bash
bunx skills add forjd/ctx --skill ctx-context-pack
```

To install it for all supported agents without prompts:

```bash
bunx skills add forjd/ctx --skill ctx-context-pack --agent '*' -y
```

You can inspect available skills first:

```bash
bunx skills add forjd/ctx --list
```

## Development

```bash
bun install
bun run check
```

Common scripts:

```bash
bun run ctx --help
bun run typecheck
bun run lint
bun run format
bun test
```

The test suite includes Laravel and Vue fixtures under `tests/fixtures/`.

## Contributing

Issues and small PRs are welcome. Keep changes boring, deterministic, and easy to inspect.

Before opening a PR:

```bash
bun run check
```

Commits use Conventional Commits:

```txt
feat: add context pack command
fix: improve Laravel test discovery
chore: update tooling
```

## Releases

Release PRs are managed by Release Please on pushes to `main`, and package publishing uses npm trusted publishing from GitHub Actions.

It uses Conventional Commits to update `package.json`, maintain `CHANGELOG.md`, tag the release, create the GitHub release, and publish `@forjd/ctx` to npm when the release PR is merged. The workflow can run with the default `GITHUB_TOKEN`; configure a `RELEASE_PLEASE_TOKEN` repository secret if Release Please PRs need to trigger other GitHub Actions workflows.

## License

MIT. See [LICENSE](LICENSE).
