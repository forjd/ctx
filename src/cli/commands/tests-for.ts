import type { CliArgs } from "../index";
import { openDatabase, readIndexedFiles } from "../../core/db";
import { changedFiles } from "../../core/git";
import { json, renderTests } from "../../core/output";
import { detectProject } from "../../core/project";
import { broaderTestCommands, recommendTests } from "../../core/scorer";
import { scanRepository } from "../../core/scanner";
import { warnIfStale } from "../../core/stale";

export async function testsForCommand(root: string, args: CliArgs): Promise<void> {
  const project = await detectProject(root);
  const db = await openDatabase(root);
  let files = readIndexedFiles(db);
  await warnIfStale(root, db, files);
  db.close();
  if (files.length === 0) files = await scanRepository(root);

  const targets = args.flags.has("changed") ? await changedFiles(root) : args.positionals;
  if (targets.length === 0) throw new Error("Usage: ctx tests-for <file|--changed>");

  const direct = recommendTests(files, targets);
  const broader = broaderTestCommands(targets.join(" "), project.frameworks);
  const reasoning = direct.length
    ? direct.map((test) => `${test.path}: ${test.reason}`)
    : ["No direct test matches found; use broader commands."];
  const payload = { targets, direct, broader, reasoning };
  console.log(
    args.flags.has("json")
      ? json(payload)
      : renderTests("Recommended tests", direct, broader, reasoning),
  );
}
