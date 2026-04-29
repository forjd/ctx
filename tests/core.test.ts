import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildContextPack } from "../src/core/context-pack";
import { analyzeDiffRisk } from "../src/core/diff-risk";
import { explainFile } from "../src/core/explain";
import { renderContextPack } from "../src/core/output";
import { detectProject } from "../src/core/project";
import { inferRules } from "../src/core/rules";
import { rankFiles, recommendTests } from "../src/core/scorer";
import { categorizeFile, extractSymbols, scanRepository } from "../src/core/scanner";

const root = process.cwd();
const laravelFixture = join(root, "tests/fixtures/laravel-basic");
const vueFixture = join(root, "tests/fixtures/node-vue-basic");
const nextFixture = join(root, "tests/fixtures/next-basic");
const nuxtFixture = join(root, "tests/fixtures/nuxt-basic");
const sveltekitFixture = join(root, "tests/fixtures/sveltekit-basic");

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

  test("detects React and Next from fixture", async () => {
    const project = await detectProject(nextFixture);
    expect(project.frameworks).toContain("react");
    expect(project.frameworks).toContain("next");
    expect(project.frameworks).toContain("typescript");
  });

  test("detects Nuxt from fixture", async () => {
    const project = await detectProject(nuxtFixture);
    expect(project.frameworks).toContain("nuxt");
    expect(project.frameworks).toContain("vue");
    expect(project.frameworks).toContain("typescript");
  });

  test("detects SvelteKit from fixture", async () => {
    const project = await detectProject(sveltekitFixture);
    expect(project.frameworks).toContain("svelte");
    expect(project.frameworks).toContain("sveltekit");
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
    expect(categorizeFile("app/page.tsx")).toBe("frontend-page");
    expect(categorizeFile("app/account/page.tsx")).toBe("frontend-page");
    expect(categorizeFile("app/api/accounts/route.ts")).toBe("api-route");
    expect(categorizeFile("src/hooks/useAccount.ts")).toBe("frontend-hook");
    expect(categorizeFile("pages/accounts/index.vue")).toBe("frontend-route");
    expect(categorizeFile("layouts/default.vue")).toBe("frontend-layout");
    expect(categorizeFile("components/AccountSummary.vue")).toBe("frontend-component");
    expect(categorizeFile("composables/useAccount.ts")).toBe("frontend-composable");
    expect(categorizeFile("src/routes/dashboard/+page.svelte")).toBe("frontend-route");
    expect(categorizeFile("src/routes/+layout.svelte")).toBe("frontend-layout");
    expect(categorizeFile("src/lib/components/AccountCard.svelte")).toBe("frontend-component");
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

  test("resolves local dependency edges", async () => {
    const laravelFiles = await scanRepository(laravelFixture);
    const job = laravelFiles.find(
      (file) => file.path === "app/Jobs/SendSourceOfFundsReminderJob.php",
    );
    expect(job?.dependencies).toContain("app/Models/SourceOfFundsRequest.php");

    const vueFiles = await scanRepository(vueFixture);
    const component = vueFiles.find((file) => file.path === "src/components/AccountSummary.vue");
    expect(component?.dependencies).toContain("src/context.ts");

    const nextFiles = await scanRepository(nextFixture);
    const page = nextFiles.find((file) => file.path === "app/page.tsx");
    expect(page?.dependencies).toContain("components/AccountCard.tsx");

    const svelteFiles = await scanRepository(sveltekitFixture);
    const route = svelteFiles.find((file) => file.path === "src/routes/dashboard/+page.svelte");
    expect(route?.language).toBe("svelte");
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

  test("uses configured synonyms and category boosts", async () => {
    const files = await scanRepository(laravelFixture);
    const ranked = rankFiles(files, "review aml cases", {
      synonyms: { aml: ["source-of-funds"] },
      categoryBoosts: { aml: ["model"] },
      broaderTestCommands: [],
    });
    expect(ranked[0]?.path).toContain("SourceOfFunds");
    expect(ranked.find((file) => file.category === "model")?.reason).toContain(
      "model is relevant to aml work",
    );
  });

  test("boosts files changed in the current diff", async () => {
    const files = await scanRepository(laravelFixture);
    const ranked = rankFiles(files, "update request lifecycle", undefined, 12, false, [
      "app/Models/SourceOfFundsRequest.php",
    ]);
    expect(ranked[0]?.path).toBe("app/Models/SourceOfFundsRequest.php");
    expect(ranked[0]?.reason).toContain("changed in current Git diff");
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
      undefined,
      { fileLimit: 3, includeSymbols: true },
    );
    expect(pack.task).toBe("add expiry reminders for source-of-funds requests");
    expect(pack.schemaVersion).toBe(1);
    expect(Array.isArray(pack.files)).toBe(true);
    expect(pack.files).toHaveLength(3);
    expect(pack.files[0]).toHaveProperty("reason");
    expect(pack.files[0]?.symbols?.length).toBeGreaterThan(0);
    expect(pack.tests[0]).toHaveProperty("command");
    expect(pack.dependencyEdges[0]).toHaveProperty("from");
    expect(pack.project.frameworks).toContain("laravel");
  });

  test("explains an indexed file with symbols and related tests", async () => {
    const files = await scanRepository(laravelFixture);
    const project = await detectProject(laravelFixture);
    const rules = await inferRules(laravelFixture, project);
    const report = explainFile("app/Jobs/SendSourceOfFundsReminderJob.php", files, rules);
    expect(report.category).toBe("job");
    expect(report.symbols.map((symbol) => symbol.name)).toContain("SendSourceOfFundsReminderJob");
    expect(report.dependencies).toContain("app/Models/SourceOfFundsRequest.php");
    expect(report.relatedTests[0]?.path).toBe("tests/Feature/SourceOfFundsReminderTest.php");
    expect(report.reasons.length).toBeGreaterThan(0);
  });
});
