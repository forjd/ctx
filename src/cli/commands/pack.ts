import { randomUUID } from "node:crypto";
import type { CliArgs } from "../index";
import { wantsAgent, wantsJson } from "../output-mode";
import { buildContextPack, savePack } from "../../core/context-pack";
import { readConfig } from "../../core/config";
import { openDatabase, readIndexedFiles, readRules } from "../../core/db";
import { changedFiles } from "../../core/git";
import { json, renderContextPack } from "../../core/output";
import { detectProject } from "../../core/project";
import { inferRules } from "../../core/rules";
import { scanRepository } from "../../core/scanner";
import { warnIfStale } from "../../core/stale";

export async function packCommand(root: string, args: CliArgs): Promise<void> {
  const task = args.positionals.join(" ").trim();
  if (!task) throw new Error("Usage: ctx pack <task>");

  const db = await openDatabase(root);
  const config = await readConfig(root);
  let files = readIndexedFiles(db);
  const project = await detectProject(root);
  let rules = readRules(db);
  await warnIfStale(root, db, files);
  if (files.length === 0) files = await scanRepository(root);
  if (rules.length === 0) rules = await inferRules(root, project);

  const changedPaths = args.flags.has("changed") ? await changedFiles(root) : [];
  const { pack, history } = await buildContextPack(
    root,
    task,
    project,
    files,
    rules,
    config.scoring,
    { ...packOptions(args), changedPaths },
  );
  const markdown = renderContextPack(pack, history);
  const output = wantsJson(args) ? json(pack) : markdown;
  const outputPath = args.values.get("output");
  if (outputPath) {
    await Bun.write(outputPath, output);
  }
  if (!outputPath || args.flags.has("stdout")) {
    console.log(output);
  }

  if (!wantsAgent(args)) {
    const id = `${new Date().toISOString().slice(0, 10)}-${slug(task)}-${randomUUID().slice(0, 8)}.md`;
    db.run(
      "insert or replace into packs (id, task, output_markdown, output_json, created_at) values (?, ?, ?, ?, ?)",
      [id, task, markdown, JSON.stringify(pack), pack.generatedAt],
    );
    if (outputPath == null) await savePack(root, id, markdown);
  }
  db.close();
}

function packOptions(args: CliArgs) {
  const explicitLimit = Number(args.values.get("files") ?? 0);
  const fileLimit = Number.isFinite(explicitLimit) && explicitLimit > 0 ? explicitLimit : undefined;
  if (args.flags.has("small")) {
    return {
      fileLimit: fileLimit ?? 6,
      testLimit: 4,
      ruleLimit: 5,
      edgeLimit: 12,
      includeSymbols: args.flags.has("include-symbols"),
    };
  }
  if (args.flags.has("full")) {
    return {
      fileLimit: fileLimit ?? 24,
      testLimit: 16,
      ruleLimit: 16,
      edgeLimit: 48,
      includeSymbols: true,
    };
  }
  if (wantsAgent(args)) {
    return {
      fileLimit: fileLimit ?? 6,
      testLimit: 4,
      ruleLimit: 5,
      edgeLimit: 12,
      includeSymbols: args.flags.has("include-symbols"),
    };
  }
  return {
    fileLimit: fileLimit ?? 12,
    includeSymbols: args.flags.has("include-symbols"),
  };
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "pack"
  );
}
