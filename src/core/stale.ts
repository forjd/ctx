import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Database } from "bun:sqlite";
import type { IndexedFile } from "../types";
import { readIndexCreatedAt, readMeta } from "./db";
import { currentHead } from "./git";

export interface StaleReport {
  isStale: boolean;
  indexedAt: string | null;
  reasons: string[];
}

const watchedFiles = [
  "package.json",
  "composer.json",
  "tsconfig.json",
  "vite.config.ts",
  ".ctx/config.json",
];

export async function analyzeStaleIndex(
  root: string,
  db: Database,
  files: IndexedFile[],
): Promise<StaleReport> {
  const indexedAt = readIndexCreatedAt(db);
  if (!indexedAt || files.length === 0) {
    return {
      isStale: true,
      indexedAt,
      reasons: ["No indexed files found. Run ctx index."],
    };
  }

  const indexedTime = Date.parse(indexedAt);
  const reasons = new Set<string>();

  for (const file of files) {
    const path = join(root, file.path);
    if (!existsSync(path)) {
      reasons.add(`${file.path} was deleted after the last index.`);
      continue;
    }
    const info = await stat(path).catch(() => null);
    if (info && info.mtimeMs > indexedTime + 1_000) {
      reasons.add(`${file.path} changed after the last index.`);
      if (reasons.size >= 5) break;
    }
  }

  for (const file of watchedFiles) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const info = await stat(path).catch(() => null);
    if (info && info.mtimeMs > indexedTime + 1_000) {
      reasons.add(`${file} changed after the last index.`);
    }
  }

  const indexedHead = readMeta(db, "git_head");
  const head = await currentHead(root);
  if (indexedHead && head && indexedHead !== head) {
    reasons.add("Git HEAD changed after the last index.");
  }

  return {
    isStale: reasons.size > 0,
    indexedAt,
    reasons: [...reasons],
  };
}

export function formatStaleWarning(report: StaleReport): string {
  if (!report.isStale) return "";
  return `ctx index may be stale: ${report.reasons.join(" ")}`;
}

export async function warnIfStale(root: string, db: Database, files: IndexedFile[]): Promise<void> {
  if (files.length === 0) return;
  const warning = formatStaleWarning(await analyzeStaleIndex(root, db, files));
  if (warning) console.error(warning);
}
