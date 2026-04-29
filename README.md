# ctx

`ctx` is a local-first CLI that builds concise context packs for coding agents before they edit a repository.

## Development

```bash
bun install
bun run ctx init
bun run ctx index
bun run ctx map
bun run ctx pack "add expiry reminders for source-of-funds requests"
```

## Commands

- `ctx init` creates `.ctx/`, SQLite storage, pack and handoff directories, and default config.
- `ctx index` scans important files, extracts lightweight symbols, infers rules, and stores metadata.
- `ctx map --json` prints detected stack, directories, and conventions.
- `ctx pack <task> --json|--markdown --output <path>` ranks relevant files/tests and suggests checks.
- `ctx tests-for <file|--changed>` recommends focused tests.
- `ctx diff-risk --json` reports simple Git diff risk signals.
- `ctx rules --json` prints inferred project rules.
- `ctx handoff --stdout|--json` writes a Markdown handoff under `.ctx/handoffs/`.

The MVP is deterministic and does not call external AI APIs.
