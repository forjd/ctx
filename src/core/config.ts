import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectConfig } from "../types";

export const ctxDirName = ".ctx";
export const defaultIgnoredDirectories = [
  ".git",
  ".ctx",
  "node_modules",
  "vendor",
  "storage",
  "dist",
  "build",
  ".next",
  "coverage",
  "opensrc",
];

export function defaultConfig(): ProjectConfig {
  return {
    version: 1,
    projectName: null,
    preferredPackageManager: "bun",
    ignoredDirectories: defaultIgnoredDirectories,
    frameworks: {
      laravel: true,
      node: true,
      express: true,
      fastify: true,
      hono: true,
      nestjs: true,
      vue: true,
      react: true,
      next: true,
      nuxt: true,
      svelte: true,
      sveltekit: true,
    },
    scoring: {
      synonyms: {},
      categoryBoosts: {},
      broaderTestCommands: [],
    },
  };
}

export function ctxPath(root: string, ...parts: string[]): string {
  return join(root, ctxDirName, ...parts);
}

export async function ensureCtxDirs(root: string): Promise<void> {
  await mkdir(ctxPath(root), { recursive: true });
  await mkdir(ctxPath(root, "handoffs"), { recursive: true });
  await mkdir(ctxPath(root, "packs"), { recursive: true });
}

export async function writeDefaultConfig(root: string): Promise<ProjectConfig> {
  const config = defaultConfig();
  const path = ctxPath(root, "config.json");
  if (!existsSync(path)) {
    await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
  }
  return readConfig(root);
}

export async function readConfig(root: string): Promise<ProjectConfig> {
  const path = ctxPath(root, "config.json");
  if (!existsSync(path)) {
    return defaultConfig();
  }

  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as Partial<ProjectConfig>;
  const defaults = defaultConfig();
  return {
    ...defaults,
    ...parsed,
    frameworks: { ...defaults.frameworks, ...parsed.frameworks },
    scoring: { ...defaults.scoring, ...parsed.scoring },
  } as ProjectConfig;
}
