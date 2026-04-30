import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CliArgs } from "../index";
import { wantsJson } from "../output-mode";
import { ctxPath } from "../../core/config";
import { currentBranch, changedFiles, recentCommits } from "../../core/git";
import { json } from "../../core/output";

export async function handoffCommand(root: string, args: CliArgs): Promise<void> {
  const branch = await currentBranch(root);
  const changed = await changedFiles(root);
  const staged = await changedFiles(root, true);
  const commits = await recentCommits(root);
  const summary = inferSummary(branch, changed);
  const tests = inferTests(changed);
  const risks = inferRisks(changed);
  const markdown = [
    "# Agent Handoff",
    "",
    "## Branch",
    branch,
    "",
    "## Changed files",
    ...bullet(changed.length ? changed : ["No unstaged changes detected."]),
    "",
    "## Staged files",
    ...bullet(staged.length ? staged : ["No staged changes detected."]),
    "",
    "## Recent commits",
    ...bullet(commits.length ? commits : ["No recent commits found."]),
    "",
    "## Summary",
    summary,
    "",
    "## Tests to run",
    ...bullet(tests),
    "",
    "## Open risks",
    ...bullet(risks),
    "",
  ].join("\n");

  const fileName = `${new Date().toISOString().slice(0, 10)}-${slug(branch === "unknown" ? "handoff" : branch)}.md`;
  const filePath = ctxPath(root, "handoffs", fileName);
  await mkdir(join(root, ".ctx", "handoffs"), { recursive: true });
  await writeFile(filePath, markdown);
  const payload = {
    branch,
    changedFiles: changed,
    stagedFiles: staged,
    recentCommits: commits,
    filePath,
    summary,
    tests,
    risks,
  };

  if (wantsJson(args)) console.log(json(payload));
  else if (args.flags.has("stdout")) console.log(markdown);
  else console.log(filePath.replace(`${root}/`, ""));
}

function inferSummary(branch: string, changed: string[]): string {
  if (changed.length === 0) return "No local changes were detected.";
  return `This branch (${branch}) currently changes ${changed.length} file(s), mostly around ${changed[0]?.split("/").slice(0, -1).join("/") || "the repository root"}.`;
}

function inferTests(changed: string[]): string[] {
  if (changed.some((file) => file.endsWith(".php"))) return ["php artisan test"];
  if (changed.some((file) => /\.(ts|tsx|js|jsx|vue)$/.test(file))) return ["bun test"];
  return ["Run the project's standard checks."];
}

function inferRisks(changed: string[]): string[] {
  const risks: string[] = [];
  if (changed.some((file) => file.includes("database/migrations/")))
    risks.push("Migration changes need rollback and fresh migration checks.");
  if (changed.some((file) => file.includes("app/Notifications/")))
    risks.push("Notification changes should avoid leaking sensitive data.");
  if (changed.some((file) => file.includes("app/Jobs/")))
    risks.push("Queue job changes should define retry/backoff expectations.");
  return risks.length ? risks : ["No specific open risks inferred."];
}

function bullet(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "handoff"
  );
}
