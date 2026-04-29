import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildContextPack } from "../src/core/context-pack";
import { detectProject } from "../src/core/project";
import { inferRules } from "../src/core/rules";
import { scanRepository } from "../src/core/scanner";

interface BenchmarkTask {
  id: string;
  repo: string;
  task: string;
  expectedFiles: string[];
  expectedTests: string[];
  minFileRecallAt10?: number;
}

interface BenchmarkResult {
  id: string;
  repo: string;
  recallAt5: number;
  recallAt10: number;
  precisionAt10: number;
  testRecall: number | null;
  packBytes: number;
  runtimeMs: number;
  passed: boolean;
  missingFiles: string[];
  missingTests: string[];
}

const root = process.cwd();
const defaultMinFileRecallAt10 = 0.75;

async function main(): Promise<void> {
  const tasks = await loadTasks();
  const results: BenchmarkResult[] = [];

  for (const task of tasks) {
    results.push(await runTask(task));
  }

  printReport(results);

  if (results.some((result) => !result.passed)) {
    process.exitCode = 1;
  }
}

async function loadTasks(): Promise<BenchmarkTask[]> {
  const raw = await readFile(join(root, "benchmarks/tasks.json"), "utf8");
  return JSON.parse(raw) as BenchmarkTask[];
}

async function runTask(task: BenchmarkTask): Promise<BenchmarkResult> {
  const started = performance.now();
  const repoRoot = join(root, task.repo);
  const project = await detectProject(repoRoot);
  const files = await scanRepository(repoRoot);
  const rules = await inferRules(repoRoot, project);
  const { pack } = await buildContextPack(repoRoot, task.task, project, files, rules, undefined, {
    fileLimit: 12,
    testLimit: 8,
  });

  const runtimeMs = performance.now() - started;
  const returnedFiles = pack.files.map((file) => file.path);
  const returnedTests = pack.tests.map((test) => test.path);
  const expectedFiles = new Set(task.expectedFiles);
  const expectedTests = new Set(task.expectedTests);
  const top5 = returnedFiles.slice(0, 5);
  const top10 = returnedFiles.slice(0, 10);
  const recallAt5 = recall(top5, expectedFiles);
  const recallAt10 = recall(top10, expectedFiles);
  const precisionAt10 = precision(top10, expectedFiles);
  const testRecall = expectedTests.size === 0 ? null : recall(returnedTests, expectedTests);
  const missingFiles = [...expectedFiles].filter((path) => !top10.includes(path));
  const missingTests = [...expectedTests].filter((path) => !returnedTests.includes(path));
  const minFileRecallAt10 = task.minFileRecallAt10 ?? defaultMinFileRecallAt10;
  const passed = recallAt10 >= minFileRecallAt10 && (testRecall === null || testRecall === 1);

  return {
    id: task.id,
    repo: task.repo,
    recallAt5,
    recallAt10,
    precisionAt10,
    testRecall,
    packBytes: Buffer.byteLength(JSON.stringify(pack)),
    runtimeMs,
    passed,
    missingFiles,
    missingTests,
  };
}

function recall(returnedPaths: string[], expectedPaths: Set<string>): number {
  if (expectedPaths.size === 0) return 1;
  const hits = returnedPaths.filter((path) => expectedPaths.has(path)).length;
  return hits / expectedPaths.size;
}

function precision(returnedPaths: string[], expectedPaths: Set<string>): number {
  if (returnedPaths.length === 0) return expectedPaths.size === 0 ? 1 : 0;
  const hits = returnedPaths.filter((path) => expectedPaths.has(path)).length;
  return hits / returnedPaths.length;
}

function printReport(results: BenchmarkResult[]): void {
  const rows = results.map((result) => [
    result.passed ? "pass" : "fail",
    result.id,
    score(result.recallAt5),
    score(result.recallAt10),
    score(result.precisionAt10),
    result.testRecall === null ? "n/a" : score(result.testRecall),
    String(result.packBytes),
    String(Math.round(result.runtimeMs)),
  ]);
  const headers = [
    "status",
    "task",
    "recall@5",
    "recall@10",
    "precision@10",
    "test recall",
    "pack bytes",
    "runtime ms",
  ];

  console.log(formatTable(headers, rows));
  console.log("");
  printSummary(results);
  printMisses(results);
}

function printSummary(results: BenchmarkResult[]): void {
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const testRecalls = results
    .map((result) => result.testRecall)
    .filter((value): value is number => value !== null);
  console.log(
    [
      `tasks: ${results.length}`,
      `passed: ${results.filter((result) => result.passed).length}/${results.length}`,
      `avg recall@10: ${score(average(results.map((result) => result.recallAt10)))}`,
      `avg precision@10: ${score(average(results.map((result) => result.precisionAt10)))}`,
      `avg test recall: ${testRecalls.length ? score(average(testRecalls)) : "n/a"}`,
    ].join(" | "),
  );
}

function printMisses(results: BenchmarkResult[]): void {
  const failures = results.filter(
    (result) => result.missingFiles.length > 0 || result.missingTests.length > 0,
  );
  if (failures.length === 0) return;

  console.log("");
  console.log("Misses:");
  for (const failure of failures) {
    if (failure.missingFiles.length > 0) {
      console.log(`- ${failure.id} files: ${failure.missingFiles.join(", ")}`);
    }
    if (failure.missingTests.length > 0) {
      console.log(`- ${failure.id} tests: ${failure.missingTests.join(", ")}`);
    }
  }
}

function score(value: number): string {
  return value.toFixed(2);
}

function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const formatRow = (row: string[]) =>
    row.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ");
  return [
    formatRow(headers),
    formatRow(widths.map((width) => "-".repeat(width))),
    ...rows.map(formatRow),
  ].join("\n");
}

await main();
