import type { CliArgs } from "../index";
import { openDatabase, readIndexedFiles, readRules } from "../../core/db";
import { explainFile } from "../../core/explain";
import { json, renderFileExplanation } from "../../core/output";
import { detectProject } from "../../core/project";
import { inferRules } from "../../core/rules";
import { scanRepository } from "../../core/scanner";

export async function explainCommand(root: string, args: CliArgs): Promise<void> {
  const path = args.positionals[0];
  if (!path) throw new Error("Usage: ctx explain <file> [--json]");

  const db = await openDatabase(root);
  let files = readIndexedFiles(db);
  let rules = readRules(db);
  db.close();

  if (files.length === 0) files = await scanRepository(root);
  if (rules.length === 0) rules = await inferRules(root, await detectProject(root));

  const report = explainFile(path, files, rules);
  console.log(args.flags.has("json") ? json(report) : renderFileExplanation(report));
}
