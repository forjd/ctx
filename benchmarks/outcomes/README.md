# Outcome Benchmarks

This benchmark is for measuring whether agents complete tasks better when they start from a `ctx` pack.

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
- `attempt-template.json`: a template for recording the run result

Record attempts as `.json` files under `benchmarks/outcomes/results`. Each file may contain one attempt object or an array:

```json
{
  "taskId": "laravel-source-of-funds-reminders",
  "variant": "ctx-pack",
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
