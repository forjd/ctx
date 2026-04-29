import type { CliArgs } from "../index";
import { openDatabase, readRules, replaceRules } from "../../core/db";
import { json, renderRules } from "../../core/output";
import { detectProject } from "../../core/project";
import { inferRules } from "../../core/rules";

export async function rulesCommand(root: string, args: CliArgs): Promise<void> {
  const db = await openDatabase(root);
  let rules = readRules(db);
  if (rules.length === 0) {
    rules = await inferRules(root, await detectProject(root));
    replaceRules(db, rules);
  }
  db.close();
  console.log(args.flags.has("json") ? json({ rules }) : renderRules(rules));
}
