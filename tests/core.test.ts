import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildContextPack } from "../src/core/context-pack";
import { analyzeDiffRisk } from "../src/core/diff-risk";
import { renderContextPack } from "../src/core/output";
import { detectProject } from "../src/core/project";
import { inferRules } from "../src/core/rules";
import { rankFiles, recommendTests } from "../src/core/scorer";
import { categorizeFile, extractSymbols, scanRepository } from "../src/core/scanner";

const root = process.cwd();
const laravelFixture = join(root, "tests/fixtures/laravel-basic");
const vueFixture = join(root, "tests/fixtures/node-vue-basic");

describe("project detection", () => {
  test("detects Laravel from fixture", async () => {
    const project = await detectProject(laravelFixture);
    expect(project.frameworks).toContain("laravel");
    expect(project.frameworks).toContain("pest");
  });

  test("detects Vue from fixture", async () => {
    const project = await detectProject(vueFixture);
    expect(project.frameworks).toContain("vue");
    expect(project.frameworks).toContain("typescript");
  });
});

describe("scanner", () => {
  test("ignores dependency and ctx directories", async () => {
    const files = await scanRepository(laravelFixture, [".git", ".ctx", "node_modules", "vendor"]);
    expect(files.some((file) => file.path.startsWith("node_modules/"))).toBe(false);
    expect(files.some((file) => file.path.startsWith("vendor/"))).toBe(false);
    expect(files.some((file) => file.path.startsWith(".git/"))).toBe(false);
    expect(files.some((file) => file.path.startsWith(".ctx/"))).toBe(false);
  });

  test("categorises Laravel files", () => {
    expect(categorizeFile("app/Models/User.php")).toBe("model");
    expect(categorizeFile("app/Jobs/SendEmail.php")).toBe("job");
    expect(categorizeFile("database/migrations/create_users.php")).toBe("migration");
    expect(categorizeFile("resources/js/Pages/Dashboard.vue")).toBe("frontend-page");
  });

  test("extracts PHP classes and enums", () => {
    const symbols = extractSymbols(
      "app/Enums/Status.php",
      "<?php\nenum Status: string {}\nclass User {}\n",
    );
    expect(symbols.map((symbol) => symbol.name)).toContain("Status");
    expect(symbols.map((symbol) => symbol.name)).toContain("User");
  });

  test("extracts TypeScript functions and types", () => {
    const symbols = extractSymbols(
      "src/context.ts",
      "export function buildContextPack() {}\ntype ContextPack = {}\n",
    );
    expect(symbols.map((symbol) => symbol.name)).toContain("buildContextPack");
    expect(symbols.map((symbol) => symbol.name)).toContain("ContextPack");
  });
});

describe("context pack behaviours", () => {
  test("ranks path matches above unrelated files", async () => {
    const files = await scanRepository(laravelFixture);
    const ranked = rankFiles(files, "add expiry reminders for source-of-funds requests");
    expect(ranked[0]?.path).toContain("SourceOfFunds");
    expect(
      ranked.find((file) => file.path.includes("SourceOfFundsReminderTest"))?.score,
    ).toBeGreaterThan(0);
  });

  test("tests-for finds direct filename matches", async () => {
    const files = await scanRepository(laravelFixture);
    const tests = recommendTests(files, ["app/Jobs/SendSourceOfFundsReminderJob.php"]);
    expect(tests[0]?.path).toBe("tests/Feature/SourceOfFundsReminderTest.php");
  });

  test("diff-risk flags migrations as high risk", async () => {
    const report = await analyzeDiffRisk(laravelFixture, [
      "database/migrations/2026_01_01_000000_create_source_of_funds_requests_table.php",
    ]);
    expect(report.riskLevel).toBe("high");
    expect(report.changedAreas).toContain("Migration");
  });

  test("Markdown output contains required sections", async () => {
    const files = await scanRepository(laravelFixture);
    const project = await detectProject(laravelFixture);
    const rules = await inferRules(laravelFixture, project);
    const { pack, history } = await buildContextPack(
      laravelFixture,
      "add expiry reminders for source-of-funds requests",
      project,
      files,
      rules,
    );
    const markdown = renderContextPack(pack, history);
    expect(markdown).toContain("## Relevant files");
    expect(markdown).toContain("## Relevant tests");
    expect(markdown).toContain("## Project rules");
    expect(markdown).toContain("## Risk notes");
    expect(markdown).toContain("## Next actions");
  });

  test("JSON output validates expected shape", async () => {
    const files = await scanRepository(laravelFixture);
    const project = await detectProject(laravelFixture);
    const rules = await inferRules(laravelFixture, project);
    const { pack } = await buildContextPack(
      laravelFixture,
      "add expiry reminders for source-of-funds requests",
      project,
      files,
      rules,
    );
    expect(pack.task).toBe("add expiry reminders for source-of-funds requests");
    expect(Array.isArray(pack.files)).toBe(true);
    expect(pack.files[0]).toHaveProperty("reason");
    expect(pack.tests[0]).toHaveProperty("command");
    expect(pack.project.frameworks).toContain("laravel");
  });
});
