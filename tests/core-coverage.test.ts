import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildContextPack, savePack } from "../src/core/context-pack";
import {
  ctxPath,
  defaultConfig,
  ensureCtxDirs,
  readConfig,
  writeDefaultConfig,
} from "../src/core/config";
import { analyzeDiffRisk } from "../src/core/diff-risk";
import { changedFiles, currentBranch, gitHistoryForTerms, recentCommits } from "../src/core/git";
import {
  json,
  renderContextPack,
  renderDiffRisk,
  renderFileExplanation,
  renderProjectMap,
  renderRules,
  renderTests,
} from "../src/core/output";
import { inferRules } from "../src/core/rules";
import { broaderTestCommands, rankFiles, recommendTests } from "../src/core/scorer";
import { hasAnyFileWithExtension, scanRepository } from "../src/core/scanner";
import type { ContextPack, IndexedFile, ProjectInfo, Rule } from "../src/types";

async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "ctx-test-"));
}

const project: ProjectInfo = {
  root: "/repo",
  frameworks: ["laravel", "vue", "typescript", "pest"],
  packageManager: "bun",
  importantDirectories: ["app/Models", "resources/js"],
  conventions: ["Uses Pest tests"],
};

const rules: Rule[] = [
  {
    text: "Use Pest for PHP tests.",
    source: "pest.php",
    confidence: "high",
  },
];

const samplePack: ContextPack = {
  schemaVersion: 1,
  task: "add reminders",
  generatedAt: "2026-04-29T00:00:00.000Z",
  project: {
    root: "/repo",
    frameworks: ["laravel"],
  },
  files: [
    {
      path: "app/Jobs/ReminderJob.php",
      score: 42,
      category: "job",
      reason: "path matches reminder",
    },
  ],
  tests: [
    {
      path: "tests/Feature/ReminderTest.php",
      command: "php artisan test tests/Feature/ReminderTest.php",
      reason: "Direct filename match.",
    },
  ],
  rules,
  risks: [
    {
      level: "medium",
      text: "Queue retry behaviour should be checked.",
    },
  ],
  dependencyEdges: [],
  suggestedCommands: ["php artisan test --filter=Reminder"],
  nextActions: ["Inspect the job."],
};

describe("config", () => {
  test("creates ctx directories and default config", async () => {
    const root = await tempRoot();
    await ensureCtxDirs(root);
    const config = await writeDefaultConfig(root);

    expect(config.preferredPackageManager).toBe("bun");
    expect(config.ignoredDirectories).toContain("opensrc");
    expect(await readFile(ctxPath(root, "config.json"), "utf8")).toContain("ignoredDirectories");
    expect(await readConfig(root)).toEqual(config);
  });

  test("merges partial config with defaults and returns defaults when missing", async () => {
    const root = await tempRoot();
    expect(await readConfig(root)).toEqual(defaultConfig());

    await ensureCtxDirs(root);
    await writeFile(
      ctxPath(root, "config.json"),
      JSON.stringify({ projectName: "demo", preferredPackageManager: "pnpm" }),
    );

    const config = await readConfig(root);
    expect(config.projectName).toBe("demo");
    expect(config.preferredPackageManager).toBe("pnpm");
    expect(config.frameworks.vue).toBe(true);
  });
});

describe("output renderers", () => {
  test("renders project maps with detected and fallback values", () => {
    expect(renderProjectMap(project)).toContain("- Laravel");
    expect(
      renderProjectMap({
        ...project,
        frameworks: [],
        importantDirectories: [],
        conventions: [],
      }),
    ).toContain("- Unknown");
  });

  test("renders rules, tests, packs, diff risk, and json", () => {
    expect(json({ ok: true })).toContain('"ok": true');
    expect(renderRules(rules)).toContain("Use Pest");
    expect(
      renderTests("Recommended tests", samplePack.tests, ["bun test"], ["Direct filename match"]),
    ).toContain("## Broader");
    expect(renderContextPack(samplePack, ["abc123 feat: add reminders"])).toContain("abc123 feat");
    expect(
      renderDiffRisk({
        schemaVersion: 1,
        riskLevel: "medium",
        changedFiles: ["app/Jobs/ReminderJob.php"],
        changedAreas: ["Queue job"],
        concerns: ["Queue job changed."],
        suggestedChecks: ["php artisan test"],
      }),
    ).toContain("Risk level: Medium");
    expect(
      renderDiffRisk({
        schemaVersion: 1,
        riskLevel: "low",
        changedFiles: [],
        changedAreas: [],
        concerns: [],
        suggestedChecks: [],
      }),
    ).toContain("No notable risk signals detected.");
  });

  test("renders file explanations with populated and fallback sections", () => {
    const populated = renderFileExplanation({
      schemaVersion: 1,
      path: "app/Services/ReminderService.php",
      category: "service",
      language: "php",
      isTest: false,
      isGenerated: false,
      reasons: ["path matches reminder"],
      symbols: [{ name: "ReminderService", kind: "class", lineStart: 7 }],
      dependencies: ["app/Models/Reminder.php"],
      dependents: ["app/Jobs/ReminderJob.php"],
      relatedTests: [
        {
          path: "tests/Feature/ReminderTest.php",
          command: "php artisan test tests/Feature/ReminderTest.php",
          reason: "Direct filename match.",
        },
      ],
      applicableRules: rules,
    });

    expect(populated).toContain("Path: app/Services/ReminderService.php");
    expect(populated).toContain("- class ReminderService:7");
    expect(populated).toContain("- app/Models/Reminder.php");
    expect(populated).toContain("- tests/Feature/ReminderTest.php");
    expect(populated).toContain("- Use Pest for PHP tests. (pest.php)");

    const fallback = renderFileExplanation({
      schemaVersion: 1,
      path: "README.md",
      category: "unknown",
      language: "markdown",
      isTest: false,
      isGenerated: false,
      reasons: ["documentation file"],
      symbols: [],
      dependencies: [],
      dependents: [],
      relatedTests: [],
      applicableRules: [],
    });

    expect(fallback).toContain("- No symbols extracted.");
    expect(fallback).toContain("- No dependencies resolved.");
    expect(fallback).toContain("- No dependents resolved.");
    expect(fallback).toContain("- No related tests found.");
    expect(fallback).toContain("- No specific rules matched.");
  });
});

describe("rules", () => {
  test("infers document, cursor, and docs rules", async () => {
    const root = await tempRoot();
    await mkdir(join(root, ".cursor/rules"), { recursive: true });
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "Use Conventional Commits. Run Pest. Use Pint.");
    await writeFile(join(root, ".cursor/rules/frontend.md"), "Vue rules");

    const inferred = await inferRules(root, project);
    expect(inferred.map((rule) => rule.text)).toContain(
      "Use Conventional Commits for commit messages.",
    );
    expect(inferred.map((rule) => rule.text)).toContain(
      "Use Laravel Pint formatting for PHP code.",
    );
    expect(inferred.some((rule) => rule.source === ".cursor/rules/frontend.md")).toBe(true);
    expect(inferred.some((rule) => rule.source === "docs")).toBe(true);
  });

  test("infers rules for supported backend and frontend frameworks", async () => {
    const root = await tempRoot();
    const inferred = await inferRules(root, {
      ...project,
      frameworks: [
        "symfony",
        "express",
        "fastify",
        "hono",
        "nestjs",
        "remix",
        "react-router",
        "astro",
        "rails",
        "django",
        "fastapi",
        "flask",
        "go",
        "wordpress",
        "drupal",
        "react",
        "next",
        "nuxt",
        "svelte",
        "sveltekit",
      ],
    });
    const texts = inferred.map((rule) => rule.text);

    expect(texts).toContain("Use Symfony console, controller, service, and entity conventions.");
    expect(texts).toContain("Keep Node HTTP routes, middleware, handlers, and schemas explicit.");
    expect(texts).toContain("Keep NestJS modules, controllers, and providers aligned.");
    expect(texts).toContain(
      "Use route modules under app/routes for Remix or React Router changes.",
    );
    expect(texts).toContain(
      "Use Astro pages and content collections under src/pages and src/content.",
    );
    expect(texts).toContain("Use Rails migrations for schema changes.");
    expect(texts).toContain("Use Django migrations for model schema changes.");
    expect(texts).toContain("Keep FastAPI routers, dependencies, and Pydantic schemas explicit.");
    expect(texts).toContain("Keep Flask routes, blueprints, and app setup explicit.");
    expect(texts).toContain("Keep Go packages small and test package behaviour with go test.");
    expect(texts).toContain("Keep WordPress plugin hooks and theme templates explicit.");
    expect(texts).toContain("Keep Drupal module routing, services, and config YAML aligned.");
    expect(texts).toContain("Use React components for frontend UI changes.");
    expect(texts).toContain("Respect Next.js app or pages routing conventions.");
    expect(texts).toContain(
      "Use Nuxt conventions for pages, layouts, composables, and server routes.",
    );
    expect(texts).toContain("Use Svelte components under src/lib/components or framework routes.");
    expect(texts).toContain("Use SvelteKit route conventions under src/routes.");
  });
});

describe("git fallbacks", () => {
  test("returns safe defaults outside a git repository", async () => {
    const root = await tempRoot();
    expect(await changedFiles(root)).toEqual([]);
    expect(await changedFiles(root, true)).toEqual([]);
    expect(await currentBranch(root)).toBe("unknown");
    expect(await recentCommits(root)).toEqual([]);
    expect(await gitHistoryForTerms(root, [])).toEqual([]);
    expect(await gitHistoryForTerms(root, ["missing"])).toEqual([]);
  });
});

describe("diff risk", () => {
  test("reports medium risk for isolated job changes", async () => {
    const report = await analyzeDiffRisk("/repo", ["app/Jobs/SyncListingsJob.php"]);

    expect(report.riskLevel).toBe("medium");
    expect(report.changedAreas).toContain("Queue job");
    expect(report.suggestedChecks).toContain("php artisan test --filter=SyncListings");
  });

  test("flags auth, validation, notifications, config, enums, casts, and money files", async () => {
    const report = await analyzeDiffRisk("/repo", [
      "app/Http/Middleware/Authenticate.php",
      "app/Policies/ReportExportPolicy.php",
      "app/Http/Requests/StorePaymentRequest.php",
      "app/Notifications/PaymentReceiptNotification.php",
      "app/Enums/BillingStatus.php",
      "config/services.php",
      "app/Casts/MoneyCast.php",
      "tests/Feature/BillingTest.php",
    ]);

    expect(report.riskLevel).toBe("high");
    expect(report.changedAreas).toContain("Authorization");
    expect(report.changedAreas).toContain("Validation request");
    expect(report.changedAreas).toContain("Notification");
    expect(report.changedAreas).toContain("Configuration");
    expect(report.changedAreas).toContain("Enum");
    expect(report.changedAreas).toContain("Database casts");
    expect(report.suggestedChecks.some((command) => command.includes("--filter="))).toBe(true);
  });
});

describe("scorer branches", () => {
  test("penalizes generated files and recommends non-PHP test commands", () => {
    const files: IndexedFile[] = [
      {
        path: "bootstrap/ssr/ssr.js",
        extension: ".js",
        language: "javascript",
        category: "unknown",
        sizeBytes: 10,
        hash: "hash",
        mtimeMs: 1,
        isTest: false,
        isGenerated: true,
        symbols: [{ name: "ReportExportService", kind: "const", lineStart: 1 }],
        dependencies: [],
      },
      {
        path: "resources/js/components/exports/ExportButton.test.ts",
        extension: ".ts",
        language: "typescript",
        category: "test",
        sizeBytes: 10,
        hash: "hash",
        mtimeMs: 1,
        isTest: true,
        isGenerated: false,
        symbols: [],
        dependencies: [],
      },
    ];

    expect(rankFiles(files, "add report exports")[0]?.path).toBe(
      "resources/js/components/exports/ExportButton.test.ts",
    );
    expect(
      recommendTests(files, ["resources/js/components/exports/ExportButton.ts"])[0]?.command,
    ).toBe("bun test resources/js/components/exports/ExportButton.test.ts");
    expect(
      broaderTestCommands("app/Services/Exports/ReportExportService.php", ["laravel"]),
    ).toContain("php artisan test --filter=ReportExportService");
  });

  test("applies a smaller penalty to lock files for dependency tasks", () => {
    const ranked = rankFiles(
      [
        {
          path: "package-lock.json",
          extension: ".json",
          language: "json",
          category: "unknown",
          sizeBytes: 10,
          hash: "hash",
          mtimeMs: 1,
          isTest: false,
          isGenerated: false,
          symbols: [],
          dependencies: [],
        },
      ],
      "update package lock",
    );

    expect(ranked[0]?.path).toBe("package-lock.json");
    expect(ranked[0]?.score).toBeGreaterThan(0);
  });

  test("penalizes very large relevant files", () => {
    const ranked = rankFiles(
      [
        {
          path: "app/Services/Reports/ReportExportService.php",
          extension: ".php",
          language: "php",
          category: "service",
          sizeBytes: 300_000,
          hash: "hash",
          mtimeMs: 1,
          isTest: false,
          isGenerated: false,
          symbols: [{ name: "ReportExportService", kind: "class", lineStart: 1 }],
          dependencies: [],
        },
      ],
      "update report exports",
    );

    expect(ranked[0]?.reason).toContain("large file penalty");
  });

  test("adds bun test when package scripts expose test", () => {
    expect(broaderTestCommands("small refactor", [], ["test"])).toEqual(["bun test"]);
  });
});

describe("context pack persistence", () => {
  test("uses fallback low risk when task and files have no specific risk signals", async () => {
    const { pack } = await buildContextPack(
      "/repo",
      "rename dashboard heading",
      {
        ...project,
        frameworks: ["typescript"],
      },
      [
        {
          path: "resources/js/pages/Dashboard.vue",
          extension: ".vue",
          language: "vue",
          category: "frontend-page",
          sizeBytes: 20,
          hash: "hash",
          mtimeMs: 1,
          isTest: false,
          isGenerated: false,
          symbols: [{ name: "Dashboard", kind: "type", lineStart: 1 }],
          dependencies: [],
        },
      ],
      [],
    );

    expect(pack.risks).toEqual([
      {
        level: "low",
        text: "No specific risk signals beyond normal regression coverage.",
      },
    ]);
  });

  test("saves a pack under ctx packs", async () => {
    const root = await tempRoot();
    await ensureCtxDirs(root);
    const path = await savePack(root, "demo.md", "# Demo\n");
    expect(path).toBe(ctxPath(root, "packs", "demo.md"));
    expect(await readFile(path, "utf8")).toBe("# Demo\n");
  });
});

describe("scanner edge cases", () => {
  test("detects file extensions and reports false when absent", async () => {
    const root = await tempRoot();
    await writeFile(join(root, "index.ts"), "export const ok = true;\n");

    expect(await hasAnyFileWithExtension(root, ".ts")).toBe(true);
    expect(await hasAnyFileWithExtension(root, ".vue")).toBe(false);
  });

  test("returns no files for an unreadable or missing root", async () => {
    const files = await scanRepository(join(await tempRoot(), "missing"));
    expect(files).toEqual([]);
  });
});
