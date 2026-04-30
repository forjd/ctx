import type { CliArgs } from "../index";
import { wantsJson } from "../output-mode";
import { openDatabase, readIndexedFiles } from "../../core/db";
import { json } from "../../core/output";
import { analyzeStaleIndex } from "../../core/stale";

export async function staleCommand(root: string, args: CliArgs): Promise<void> {
  const db = await openDatabase(root);
  const files = readIndexedFiles(db);
  const report = await analyzeStaleIndex(root, db, files);
  db.close();

  if (wantsJson(args)) {
    console.log(json(report));
    return;
  }

  console.log(report.isStale ? "ctx index is stale." : "ctx index is fresh.");
  if (report.indexedAt) console.log(`Indexed at: ${report.indexedAt}`);
  for (const reason of report.reasons) console.log(`- ${reason}`);
}
