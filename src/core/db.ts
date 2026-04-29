import { Database } from "bun:sqlite";
import { ctxPath, ensureCtxDirs } from "./config";
import type { IndexedFile, Rule } from "../types";

export async function openDatabase(root: string): Promise<Database> {
  await ensureCtxDirs(root);
  const db = new Database(ctxPath(root, "ctx.sqlite"));
  migrate(db);
  return db;
}

export function migrate(db: Database): void {
  db.run(`
    create table if not exists files (
      id integer primary key autoincrement,
      path text not null unique,
      extension text,
      language text,
      category text,
      size_bytes integer,
      hash text,
      is_test integer not null default 0,
      is_generated integer not null default 0,
      mtime_ms integer,
      indexed_at text not null
    );
  `);
  db.run(`
    create table if not exists symbols (
      id integer primary key autoincrement,
      file_id integer not null,
      name text not null,
      kind text,
      line_start integer,
      line_end integer,
      foreign key (file_id) references files(id)
    );
  `);
  db.run(`
    create table if not exists dependencies (
      id integer primary key autoincrement,
      file_id integer not null,
      target_path text not null,
      foreign key (file_id) references files(id)
    );
  `);
  db.run(`
    create table if not exists rules (
      id integer primary key autoincrement,
      text text not null,
      source text,
      confidence text,
      created_at text not null
    );
  `);
  db.run(`
    create table if not exists packs (
      id text primary key,
      task text not null,
      output_markdown text not null,
      output_json text not null,
      created_at text not null
    );
  `);
  db.run(`
    create table if not exists handoffs (
      id text primary key,
      branch text,
      file_path text not null,
      summary text not null,
      created_at text not null
    );
  `);
}

export function replaceIndexedFiles(db: Database, files: IndexedFile[]): void {
  const insertFile = db.prepare(`
    insert into files
      (path, extension, language, category, size_bytes, hash, is_test, is_generated, mtime_ms, indexed_at)
    values
      ($path, $extension, $language, $category, $sizeBytes, $hash, $isTest, $isGenerated, $mtimeMs, $indexedAt)
    on conflict(path) do update set
      extension = excluded.extension,
      language = excluded.language,
      category = excluded.category,
      size_bytes = excluded.size_bytes,
      hash = excluded.hash,
      is_test = excluded.is_test,
      is_generated = excluded.is_generated,
      mtime_ms = excluded.mtime_ms,
      indexed_at = excluded.indexed_at
  `);
  const fileId = db.prepare("select id from files where path = ?");
  const insertSymbol = db.prepare(`
    insert into symbols (file_id, name, kind, line_start, line_end)
    values (?, ?, ?, ?, ?)
  `);
  const insertDependency = db.prepare(`
    insert into dependencies (file_id, target_path)
    values (?, ?)
  `);

  const tx = db.transaction((rows: IndexedFile[]) => {
    db.run("delete from symbols");
    db.run("delete from dependencies");
    db.run("delete from files");
    const indexedAt = new Date().toISOString();
    for (const file of rows) {
      insertFile.run({
        $path: file.path,
        $extension: file.extension,
        $language: file.language,
        $category: file.category,
        $sizeBytes: file.sizeBytes,
        $hash: file.hash,
        $isTest: file.isTest ? 1 : 0,
        $isGenerated: file.isGenerated ? 1 : 0,
        $mtimeMs: Math.round(file.mtimeMs),
        $indexedAt: indexedAt,
      });
      const row = fileId.get(file.path) as { id: number } | null;
      if (!row) continue;
      for (const symbol of file.symbols) {
        insertSymbol.run(
          row.id,
          symbol.name,
          symbol.kind,
          symbol.lineStart,
          symbol.lineEnd ?? null,
        );
      }
      for (const dependency of file.dependencies) {
        insertDependency.run(row.id, dependency);
      }
    }
  });
  tx(files);
}

export function readIndexedFiles(db: Database): IndexedFile[] {
  const rows = db.query("select * from files order by path").all() as Array<
    Record<string, unknown>
  >;
  const symbols = db
    .query(
      "select f.path, s.name, s.kind, s.line_start, s.line_end from symbols s join files f on f.id = s.file_id",
    )
    .all() as Array<Record<string, unknown>>;
  const dependencies = db
    .query(
      "select f.path, d.target_path from dependencies d join files f on f.id = d.file_id order by f.path, d.target_path",
    )
    .all() as Array<Record<string, unknown>>;
  const byPath = new Map<string, IndexedFile["symbols"]>();
  const dependenciesByPath = new Map<string, string[]>();
  for (const symbol of symbols) {
    const path = String(symbol.path);
    const list = byPath.get(path) ?? [];
    list.push({
      name: String(symbol.name),
      kind: String(symbol.kind ?? "symbol"),
      lineStart: Number(symbol.line_start ?? 1),
      lineEnd: symbol.line_end == null ? undefined : Number(symbol.line_end),
    });
    byPath.set(path, list);
  }
  for (const dependency of dependencies) {
    const path = String(dependency.path);
    const list = dependenciesByPath.get(path) ?? [];
    list.push(String(dependency.target_path));
    dependenciesByPath.set(path, list);
  }

  return rows.map((row) => ({
    path: String(row.path),
    extension: String(row.extension ?? ""),
    language: String(row.language ?? "unknown"),
    category: String(row.category ?? "unknown") as IndexedFile["category"],
    sizeBytes: Number(row.size_bytes ?? 0),
    hash: String(row.hash ?? ""),
    mtimeMs: Number(row.mtime_ms ?? 0),
    isTest: Boolean(row.is_test),
    isGenerated: Boolean(row.is_generated),
    symbols: byPath.get(String(row.path)) ?? [],
    dependencies: dependenciesByPath.get(String(row.path)) ?? [],
  }));
}

export function replaceRules(db: Database, rules: Rule[]): void {
  const insert = db.prepare(
    "insert into rules (text, source, confidence, created_at) values (?, ?, ?, ?)",
  );
  const tx = db.transaction((rows: Rule[]) => {
    db.run("delete from rules");
    const now = new Date().toISOString();
    for (const rule of rows) {
      insert.run(rule.text, rule.source, rule.confidence, now);
    }
  });
  tx(rules);
}

export function readRules(db: Database): Rule[] {
  return (
    db.query("select text, source, confidence from rules order by id").all() as Array<
      Record<string, unknown>
    >
  ).map((row) => ({
    text: String(row.text),
    source: String(row.source ?? "inferred"),
    confidence: String(row.confidence ?? "medium") as Rule["confidence"],
  }));
}
