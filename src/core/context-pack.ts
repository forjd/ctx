import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ContextPack, IndexedFile, ProjectInfo, Rule } from "../types";
import { gitHistoryForTerms } from "./git";
import { broaderTestCommands, rankFiles, recommendTests, taskTerms } from "./scorer";

export async function buildContextPack(
  root: string,
  task: string,
  project: ProjectInfo,
  files: IndexedFile[],
  rules: Rule[],
): Promise<{ pack: ContextPack; history: string[] }> {
  const ranked = rankFiles(files, task);
  const targetPaths = ranked.map((file) => file.path);
  const tests = recommendTests(files, targetPaths, project.frameworks);
  const history = await gitHistoryForTerms(root, taskTerms(task).slice(0, 6));
  const suggestedCommands = [
    ...tests.slice(0, 3).map((test) => test.command),
    ...broaderTestCommands(task, project.frameworks),
  ].filter((value, index, values) => values.indexOf(value) === index);

  const pack: ContextPack = {
    task,
    generatedAt: new Date().toISOString(),
    project: {
      root,
      frameworks: project.frameworks,
    },
    files: ranked,
    tests,
    rules: rules.slice(0, 8),
    risks: riskNotes(
      task,
      ranked.map((file) => file.category),
    ),
    suggestedCommands,
    nextActions: [
      "Inspect the highest ranked files before editing.",
      "Confirm domain timing and edge cases for the requested behaviour.",
      "Add or update focused tests before changing behaviour.",
      "Run the recommended checks.",
    ],
  };

  return { pack, history };
}

export async function savePack(root: string, id: string, markdown: string): Promise<string> {
  const path = join(root, ".ctx", "packs", id);
  await writeFile(path, markdown);
  return path;
}

function riskNotes(task: string, categories: string[]): ContextPack["risks"] {
  const lower = task.toLowerCase();
  const risks: ContextPack["risks"] = [];
  if (/reminder|notify|notification|email|mail/.test(lower)) {
    risks.push({
      level: "medium",
      text: "Reminder logic may send duplicate notifications if idempotency is not handled.",
    });
  }
  if (/expiry|expire|expired|expiration/.test(lower)) {
    risks.push({
      level: "medium",
      text: "Expired and completed entities may need distinct handling.",
    });
  }
  if (categories.includes("migration")) {
    risks.push({ level: "medium", text: "Schema changes require migration and rollback checks." });
  }
  if (categories.includes("job")) {
    risks.push({ level: "medium", text: "Queue retry and backoff behaviour should be explicit." });
  }
  if (risks.length === 0)
    risks.push({
      level: "low",
      text: "No specific risk signals beyond normal regression coverage.",
    });
  return risks;
}
