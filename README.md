# ctx

[![Built with Bun](https://img.shields.io/badge/Bun-runtime-black?logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Local context packs for coding agents.

`ctx` is a deterministic CLI that scans a repository and generates the files, tests, rules, risks, and commands an agent should inspect before editing code. It is local-first, fast, and does not call an AI API.

## Why

Coding agents are more useful when they start with the right context. `ctx` gives them a compact, task-specific brief instead of asking them to wander through a whole repository.

It can:

- detect Laravel, Vue, Node, TypeScript, and Pest projects
- index important files and lightweight symbols
- infer project rules from config and docs
- rank task-relevant files with reasons
- recommend focused tests
- flag risky Git diffs
- write handoff summaries after a run

## Quick Start

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
bun run /path/to/ctx/src/cli/index.ts init
bun run /path/to/ctx/src/cli/index.ts index
bun run /path/to/ctx/src/cli/index.ts pack "add expiry reminders for source-of-funds requests"
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
| `ctx handoff`             | Write a Markdown handoff under `.ctx/handoffs/`.                          |

Useful options:

```bash
ctx pack "task" --json
ctx pack "task" --markdown
ctx pack "task" --output .ctx/packs/my-task.md
ctx handoff --stdout
```

## How It Works

`ctx` uses simple local heuristics:

- path-based framework and category detection
- lightweight regex symbol extraction
- keyword and synonym matching
- test filename/domain similarity
- Git diff and history inspection
- SQLite storage via `bun:sqlite`

There are no embeddings, hosted services, background daemons, or external AI calls.

## Supported Today

Best coverage:

- Laravel apps
- Vue frontends
- TypeScript and JavaScript projects
- Pest/PHPUnit-style test layouts
- general Git repositories

This is still an MVP. The goal is to prove that a small deterministic context engine can improve agent setup before code edits.

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

## License

MIT. See [LICENSE](LICENSE).
