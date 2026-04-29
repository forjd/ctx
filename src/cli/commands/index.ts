import { readConfig } from "../../core/config";
import { openDatabase, replaceIndexedFiles, replaceRules, setMeta } from "../../core/db";
import { currentHead } from "../../core/git";
import { detectProject } from "../../core/project";
import { inferRules } from "../../core/rules";
import { scanRepository } from "../../core/scanner";

export async function indexCommand(root: string): Promise<void> {
  const config = await readConfig(root);
  const project = await detectProject(root);
  const files = await scanRepository(root, config.ignoredDirectories);
  const rules = await inferRules(root, project);
  const db = await openDatabase(root);
  replaceIndexedFiles(db, files);
  replaceRules(db, rules);
  const head = await currentHead(root);
  if (head) setMeta(db, "git_head", head);
  db.close();

  console.log(`ctx index complete.
Files indexed: ${files.length}
Rules inferred: ${rules.length}
Detected stack: ${project.frameworks.join(", ") || "unknown"}`);
}
