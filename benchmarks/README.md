# Retrieval Benchmarks

These benchmarks check whether `ctx pack` retrieves the files and tests that a task is expected to need.

Run:

```bash
bun run benchmark
```

The first task set uses the small fixtures in `tests/fixtures`. Each task declares expected files, expected tests, and an optional minimum `recall@10` threshold. The runner reports:

- `recall@5`: expected files found in the first five ranked files
- `recall@10`: expected files found in the first ten ranked files
- `precision@10`: how many of the first ten ranked files are expected files
- `test recall`: expected tests found in the recommended tests
- `pack bytes`: JSON size of the generated context pack
- `runtime ms`: time to detect, scan, infer rules, and build the pack

Fixture gold files are intentionally small and imperfect. Use this benchmark to catch ranking regressions, then expand it with real historical commits for stronger evidence.

## Outcome Benchmark

The outcome benchmark checks recorded agent attempts for `no-context` versus `ctx-pack` variants.

Run:

```bash
bun run benchmark:outcomes
```

See `benchmarks/outcomes/README.md` for the recording format.
