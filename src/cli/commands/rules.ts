import type { CliArgs } from "../index";
import { wantsJson } from "../output-mode";
import { openDatabase, readRules, replaceRules } from "../../core/db";
import { json, renderRules } from "../../core/output";
import { detectProject } from "../../core/project";
import { inferRules } from "../../core/rules";
import { schemaVersion } from "../../core/schema";

export async function rulesCommand(root: string, args: CliArgs): Promise<void> {
  const db = await openDatabase(root);
  let rules = readRules(db);
  if (rules.length === 0) {
    rules = await inferRules(root, await detectProject(root));
    replaceRules(db, rules);
  }
  db.close();
  console.log(wantsJson(args) ? json({ schemaVersion, rules }) : renderRules(rules));
}
