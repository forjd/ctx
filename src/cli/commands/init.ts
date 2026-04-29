import { ensureCtxDirs, writeDefaultConfig } from "../../core/config";
import { openDatabase } from "../../core/db";
import { detectProject } from "../../core/project";

export async function initCommand(root: string): Promise<void> {
  await ensureCtxDirs(root);
  await writeDefaultConfig(root);
  const db = await openDatabase(root);
  db.close();
  const project = await detectProject(root);

  console.log(`ctx initialised.
Project type: ${project.frameworks.map((name) => name.charAt(0).toUpperCase() + name.slice(1)).join(", ") || "Unknown"}
Index database: .ctx/ctx.sqlite
Next: run ctx index`);
}
