# ctx-context-pack

Use this skill when an agent needs repository context before making code changes, especially in Laravel, Vue, TypeScript, JavaScript, PHP, or general Git repositories.

The goal is to call `ctx` as a local context engine, not to replace normal code reading or testing.

## When To Use

Use this skill when:

- starting work in an unfamiliar repository
- preparing to edit a Laravel/Vue app
- a task may touch tests, migrations, jobs, notifications, policies, requests, frontend pages, or Git history
- a handoff summary is needed after an agent run
- the user asks for a context pack, repo map, test recommendations, diff risk, or handoff

Do not use this skill for tiny single-file edits where the relevant context is already obvious.

## Command Setup

From the target repository, call the `ctx` checkout directly:

```bash
bun run /path/to/ctx/src/cli/index.ts --help
```

If `ctx` is installed on PATH, use:

```bash
ctx --help
```

## Standard Workflow

Run these from the target repository:

```bash
bun run /path/to/ctx/src/cli/index.ts init
bun run /path/to/ctx/src/cli/index.ts index
bun run /path/to/ctx/src/cli/index.ts map
bun run /path/to/ctx/src/cli/index.ts pack "describe the coding task"
```

For machine-readable output:

```bash
bun run /path/to/ctx/src/cli/index.ts pack "describe the coding task" --json
```

Before or after changes:

```bash
bun run /path/to/ctx/src/cli/index.ts tests-for --changed
bun run /path/to/ctx/src/cli/index.ts diff-risk
```

At handoff:

```bash
bun run /path/to/ctx/src/cli/index.ts handoff
```

## How To Use The Pack

Read the context pack before editing. Prioritize:

- highest-ranked files with strong path or symbol reasons
- direct test recommendations
- project rules from `AGENTS.md`, `CLAUDE.md`, config files, and docs
- risk notes involving migrations, jobs, notifications, policies, validation, money, config, or enums
- suggested commands that match the files being changed

Use the pack as a starting point. If the pack is noisy, inspect the relevant repo structure and rerun with a more specific task.

## Rerun Index When Needed

Rerun `ctx index` after:

- adding, deleting, or renaming files
- pulling or switching branches
- changing generated route/action files that are intended to be indexed
- updating project rules or docs

## Cleanup

`ctx init`, `ctx index`, `ctx pack`, and `ctx handoff` create `.ctx/` in the target repository.

If the user only asked for a smoke test against another repo, remove `.ctx/` afterward unless they want to keep the index:

```bash
rm -rf .ctx
```

Never remove `.ctx/` if it contains handoffs or packs the user asked to keep.

## Notes

- `ctx` is deterministic and local-first.
- It does not call external AI APIs.
- It does not edit application code.
- It may miss context in unsupported layouts; compensate with normal repo inspection.
- Keep any feedback about noisy or missing results focused so the `ctx` heuristics can be improved.
