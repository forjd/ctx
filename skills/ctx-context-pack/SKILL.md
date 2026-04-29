# ctx-context-pack

Use this skill when an agent needs repository context before making code changes in a supported application or general Git repository.

The goal is to call `ctx` as a local context engine, not to replace normal code reading or testing.

## When To Use

Use this skill when:

- starting work in an unfamiliar repository
- preparing to edit a Laravel, Symfony, WordPress, Drupal, Rails, Django, FastAPI, Flask, Go, Vue, React, Next.js, Nuxt, SvelteKit, Node, NestJS, Remix, React Router, Astro, TypeScript, JavaScript, PHP, or general Git repository
- a task may touch tests, migrations, jobs, notifications, policies, requests, controllers, routes, frontend pages, services, config, or Git history
- a handoff summary is needed after an agent run
- the user asks for a context pack, repo map, project rules, file explanation, test recommendations, stale index check, diff risk, or handoff

Do not use this skill for tiny single-file edits where the relevant context is already obvious.

## Command Setup

From the target repository, use the published Bun CLI:

```bash
bunx @forjd/ctx --help
```

If `ctx` is installed on PATH, use:

```bash
ctx --help
```

From a local source checkout, use:

```bash
bun run /path/to/ctx/src/cli/index.ts --help
```

## Standard Workflow

Run these from the target repository:

```bash
ctx init
ctx index
ctx stale
ctx map
ctx pack "describe the coding task"
```

For machine-readable output:

```bash
ctx pack "describe the coding task" --json
```

For focused inspection:

```bash
ctx rules
ctx explain path/to/file.ext
```

Before or after changes:

```bash
ctx tests-for --changed
ctx diff-risk
```

At handoff:

```bash
ctx handoff
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

Commands that use the index may create `.ctx/` in the target repository. This includes `ctx init`, `ctx index`, `ctx pack`, `ctx tests-for`, `ctx rules`, `ctx stale`, and `ctx handoff`.

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
