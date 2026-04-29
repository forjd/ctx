import { randomUUID } from "node:crypto";
import type { CliArgs } from "../index";
import { buildContextPack, savePack } from "../../core/context-pack";
import { openDatabase, readIndexedFiles, readRules } from "../../core/db";
import { json, renderContextPack } from "../../core/output";
import { detectProject } from "../../core/project";
import { inferRules } from "../../core/rules";
import { scanRepository } from "../../core/scanner";
import { warnIfStale } from "../../core/stale";

export async function packCommand(root: string, args: CliArgs): Promise<void> {
  const task = args.positionals.join(" ").trim();
  if (!task) throw new Error("Usage: ctx pack <task>");

  const db = await openDatabase(root);
  let files = readIndexedFiles(db);
  const project = await detectProject(root);
  let rules = readRules(db);
  await warnIfStale(root, db, files);
  if (files.length === 0) files = await scanRepository(root);
  if (rules.length === 0) rules = await inferRules(root, project);

  const { pack, history } = await buildContextPack(root, task, project, files, rules);
  const markdown = renderContextPack(pack, history);
  const output = args.flags.has("json") ? json(pack) : markdown;
  const outputPath = args.values.get("output");
  if (outputPath) {
    await Bun.write(outputPath, output);
  }
  if (!outputPath || args.flags.has("stdout")) {
    console.log(output);
  }

  const id = `${new Date().toISOString().slice(0, 10)}-${slug(task)}-${randomUUID().slice(0, 8)}.md`;
  db.run(
    "insert or replace into packs (id, task, output_markdown, output_json, created_at) values (?, ?, ?, ?, ?)",
    [id, task, markdown, JSON.stringify(pack), pack.generatedAt],
  );
  db.close();
  if (outputPath == null) await savePack(root, id, markdown);
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
