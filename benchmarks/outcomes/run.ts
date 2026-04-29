import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildContextPack } from "../../src/core/context-pack";
import { renderContextPack } from "../../src/core/output";
import { detectProject } from "../../src/core/project";
import { inferRules } from "../../src/core/rules";
import { scanRepository } from "../../src/core/scanner";

type Variant = "no-context" | "ctx-pack";

interface OutcomeTask {
  id: string;
  repo: string;
  task: string;
  expectedFiles: string[];
  expectedTests: string[];
}

interface OutcomeAttempt {
  taskId: string;
  variant: Variant;
  runId: string;
  agent?: string;
  success: boolean;
  elapsedMs?: number;
  toolCalls?: number;
  filesRead?: string[];
  filesEdited: string[];
  testsRun?: string[];
}

interface AttemptScore extends OutcomeAttempt {
  relevantEditRecall: number;
  irrelevantEdited: string[];
  expectedTestRecall: number | null;
}

const root = process.cwd();
const variants: Variant[] = ["no-context", "ctx-pack"];

async function main(): Promise<void> {
  const tasks = await loadTasks();
  await writeBriefs(tasks);

  const attempts = await loadAttempts();
  if (attempts.length === 0) {
    console.log("Wrote outcome benchmark briefs under .tmp/benchmark-outcomes.");
    console.log("No recorded attempts found under benchmarks/outcomes/results.");
    console.log("Add attempt JSON files there, then rerun bun run benchmark:outcomes.");
    return;
  }

  const scores = scoreAttempts(tasks, attempts);
  printAttemptReport(scores);
  printVariantSummary(scores);
}

async function loadTasks(): Promise<OutcomeTask[]> {
  const raw = await readFile(join(root, "benchmarks/outcomes/tasks.json"), "utf8");
  return JSON.parse(raw) as OutcomeTask[];
}

async function writeBriefs(tasks: OutcomeTask[]): Promise<void> {
  const outputRoot = join(root, ".tmp/benchmark-outcomes");
  await mkdir(outputRoot, { recursive: true });

  for (const task of tasks) {
    const taskRoot = join(outputRoot, task.id);
    await mkdir(taskRoot, { recursive: true });
    await writeFile(join(taskRoot, "no-context.md"), noContextBrief(task));
    await writeFile(join(taskRoot, "ctx-pack.md"), await ctxPackBrief(task));
    await writeFile(join(taskRoot, "attempt-template.json"), attemptTemplate(task));
  }
}

function noContextBrief(task: OutcomeTask): string {
  return [
    "# Agent Outcome Benchmark",
    "",
    `Task ID: ${task.id}`,
    `Repository: ${task.repo}`,
    "",
    "## Task",
    "",
    task.task,
    "",
    "## Instructions",
    "",
    "Start from the repository and complete the task. Record the files read, files edited, tests run, elapsed time, and whether verification passed.",
    "",
  ].join("\n");
}

async function ctxPackBrief(task: OutcomeTask): Promise<string> {
  const repoRoot = join(root, task.repo);
  const project = await detectProject(repoRoot);
  const files = await scanRepository(repoRoot);
  const rules = await inferRules(repoRoot, project);
  const { pack, history } = await buildContextPack(
    repoRoot,
    task.task,
    project,
    files,
    rules,
    undefined,
    {
      fileLimit: 12,
      testLimit: 8,
    },
  );

  return [
    "# Agent Outcome Benchmark",
    "",
    `Task ID: ${task.id}`,
    `Repository: ${task.repo}`,
    "",
    renderContextPack(pack, history),
  ].join("\n");
}

function attemptTemplate(task: OutcomeTask): string {
  return `${JSON.stringify(
    {
      taskId: task.id,
      variant: "ctx-pack",
      runId: "replace-with-stable-run-id",
      agent: "replace-with-agent-name",
      success: false,
      elapsedMs: 0,
      toolCalls: 0,
      filesRead: [],
      filesEdited: [],
      testsRun: [],
    },
    null,
    2,
  )}\n`;
}

async function loadAttempts(): Promise<OutcomeAttempt[]> {
  const resultsRoot = join(root, "benchmarks/outcomes/results");
  if (!existsSync(resultsRoot)) return [];

  const files = (await readdir(resultsRoot)).filter((file) => file.endsWith(".json")).sort();
  const attempts: OutcomeAttempt[] = [];
  for (const file of files) {
    const raw = await readFile(join(resultsRoot, file), "utf8");
    const parsed = JSON.parse(raw) as OutcomeAttempt | OutcomeAttempt[];
    attempts.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  }
  return attempts;
}

function scoreAttempts(tasks: OutcomeTask[], attempts: OutcomeAttempt[]): AttemptScore[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  return attempts.map((attempt) => {
    const task = taskMap.get(attempt.taskId);
    if (!task) throw new Error(`Unknown outcome benchmark task: ${attempt.taskId}`);
    if (!variants.includes(attempt.variant)) {
      throw new Error(`Unknown outcome benchmark variant: ${attempt.variant}`);
    }

    const edited = new Set(attempt.filesEdited);
    const expectedFiles = new Set(task.expectedFiles);
    const expectedTests = new Set(task.expectedTests);
    const relevantEditRecall = recall(attempt.filesEdited, expectedFiles);
    const irrelevantEdited = [...edited].filter((path) => !expectedFiles.has(path));
    const expectedTestRecall =
      expectedTests.size === 0 ? null : recall(attempt.testsRun ?? [], expectedTests);

    return {
      ...attempt,
      relevantEditRecall,
      irrelevantEdited,
      expectedTestRecall,
    };
  });
}

function recall(returnedPaths: string[], expectedPaths: Set<string>): number {
  if (expectedPaths.size === 0) return 1;
  const hits = returnedPaths.filter((path) =>
    [...expectedPaths].some((expectedPath) => path === expectedPath || path.includes(expectedPath)),
  ).length;
  return Math.min(1, hits / expectedPaths.size);
}

function printAttemptReport(scores: AttemptScore[]): void {
  const rows = scores.map((score) => [
    score.success ? "pass" : "fail",
    score.taskId,
    score.variant,
    score.runId,
    fixed(score.relevantEditRecall),
    String(score.irrelevantEdited.length),
    score.expectedTestRecall === null ? "n/a" : fixed(score.expectedTestRecall),
    score.elapsedMs === undefined ? "n/a" : String(Math.round(score.elapsedMs)),
    score.toolCalls === undefined ? "n/a" : String(score.toolCalls),
  ]);
  console.log(
    table(
      [
        "status",
        "task",
        "variant",
        "run",
        "edit recall",
        "irrelevant edits",
        "test recall",
        "elapsed ms",
        "tool calls",
      ],
      rows,
    ),
  );
}

function printVariantSummary(scores: AttemptScore[]): void {
  console.log("");
  const rows = variants.map((variant) => {
    const variantScores = scores.filter((score) => score.variant === variant);
    if (variantScores.length === 0) return [variant, "0", "n/a", "n/a", "n/a", "n/a"];
    return [
      variant,
      String(variantScores.length),
      fixed(average(variantScores.map((score) => (score.success ? 1 : 0)))),
      fixed(average(variantScores.map((score) => score.relevantEditRecall))),
      fixed(average(variantScores.map((score) => score.irrelevantEdited.length))),
      fixed(average(variantScores.map((score) => score.elapsedMs ?? 0))),
    ];
  });
  console.log(
    table(
      ["variant", "runs", "success rate", "edit recall", "irrelevant edits", "elapsed ms"],
      rows,
    ),
  );
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function fixed(value: number): string {
  return value.toFixed(2);
}

function table(headers: string[], rows: string[][]): string {
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
