# Outcome Benchmarks

This benchmark is for measuring whether agents complete tasks better with `ctx`.

It does not run an agent. The benchmark only:

1. writes comparable prompt briefs for each task and variant
2. reads recorded agent attempts from `benchmarks/outcomes/results`
3. scores success, edit relevance, test coverage, elapsed time, and tool calls

Run:

```bash
bun run benchmark:outcomes
```

Generated briefs are written to `.tmp/benchmark-outcomes/<task-id>/`:

- `no-context.md`: the task with no `ctx` pack
- `ctx-pack.md`: the same task plus a generated context pack
- `ctx-skill.md`: the same task plus the `ctx-context-pack` skill workflow, but no precomputed pack
- `attempt-template.json`: templates for recording run results

Use the variants for different claims:

- `no-context`: normal agent baseline
- `ctx-pack`: isolates whether the generated pack helps
- `ctx-skill`: measures the fuller agent workflow where the agent decides how to call `ctx`

Record attempts as `.json` files under `benchmarks/outcomes/results`. Each file may contain one attempt object or an array:

```json
{
  "taskId": "laravel-source-of-funds-reminders",
  "variant": "ctx-skill",
  "runId": "codex-2026-04-29-001",
  "agent": "codex",
  "success": true,
  "elapsedMs": 180000,
  "toolCalls": 18,
  "filesRead": ["app/Models/SourceOfFundsRequest.php"],
  "filesEdited": [
    "app/Models/SourceOfFundsRequest.php",
    "app/Jobs/SendSourceOfFundsReminderJob.php",
    "tests/Feature/SourceOfFundsReminderTest.php"
  ],
  "testsRun": ["php artisan test tests/Feature/SourceOfFundsReminderTest.php"]
}
```

Use the same agent, model, repository state, and task for each variant. The meaningful comparison is not one run; it is repeated runs across tasks.
