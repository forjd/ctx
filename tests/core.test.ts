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
const astroFixture = join(root, "tests/fixtures/astro-basic");
const djangoFixture = join(root, "tests/fixtures/django-basic");
const fastapiFixture = join(root, "tests/fixtures/fastapi-basic");
const laravelFixture = join(root, "tests/fixtures/laravel-basic");
const symfonyFixture = join(root, "tests/fixtures/symfony-basic");
const nestFixture = join(root, "tests/fixtures/nest-basic");
const nodeHttpFixture = join(root, "tests/fixtures/node-http-basic");
const vueFixture = join(root, "tests/fixtures/node-vue-basic");
const nextFixture = join(root, "tests/fixtures/next-basic");
const nuxtFixture = join(root, "tests/fixtures/nuxt-basic");
const railsFixture = join(root, "tests/fixtures/rails-basic");
const remixFixture = join(root, "tests/fixtures/remix-basic");
const sveltekitFixture = join(root, "tests/fixtures/sveltekit-basic");

describe("project detection", () => {
  test("detects Laravel from fixture", async () => {
    const project = await detectProject(laravelFixture);
    expect(project.frameworks).toContain("laravel");
    expect(project.frameworks).toContain("pest");
  });

  test("detects Symfony from fixture", async () => {
    const project = await detectProject(symfonyFixture);
    expect(project.frameworks).toContain("symfony");
    expect(project.importantDirectories).toContain("src/Entity");
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

  test("detects Node HTTP frameworks from fixture", async () => {
    const project = await detectProject(nodeHttpFixture);
    expect(project.frameworks).toContain("node");
    expect(project.frameworks).toContain("express");
    expect(project.frameworks).toContain("fastify");
    expect(project.frameworks).toContain("hono");
  });

  test("detects NestJS from fixture", async () => {
    const project = await detectProject(nestFixture);
    expect(project.frameworks).toContain("node");
    expect(project.frameworks).toContain("nestjs");
    expect(project.frameworks).toContain("typescript");
  });

  test("detects Remix and React Router from fixture", async () => {
    const project = await detectProject(remixFixture);
    expect(project.frameworks).toContain("remix");
    expect(project.frameworks).toContain("react-router");
    expect(project.frameworks).toContain("typescript");
  });

  test("detects Astro from fixture", async () => {
    const project = await detectProject(astroFixture);
    expect(project.frameworks).toContain("astro");
    expect(project.frameworks).toContain("typescript");
  });

  test("detects Rails from fixture", async () => {
    const project = await detectProject(railsFixture);
    expect(project.frameworks).toContain("rails");
    expect(project.importantDirectories).toContain("app/models");
  });

  test("detects Django from fixture", async () => {
    const project = await detectProject(djangoFixture);
    expect(project.frameworks).toContain("django");
  });

  test("detects FastAPI from fixture", async () => {
    const project = await detectProject(fastapiFixture);
    expect(project.frameworks).toContain("fastapi");
    expect(project.importantDirectories).toContain("app/routers");
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
    expect(categorizeFile("src/Entity/Account.php")).toBe("model");
    expect(categorizeFile("app/models/account.rb")).toBe("model");
    expect(categorizeFile("app/Jobs/SendEmail.php")).toBe("job");
    expect(categorizeFile("app/controllers/accounts_controller.rb")).toBe("controller");
    expect(categorizeFile("src/Controller/AccountController.php")).toBe("controller");
    expect(categorizeFile("src/Service/AccountExporter.php")).toBe("service");
    expect(categorizeFile("database/migrations/create_users.php")).toBe("migration");
    expect(categorizeFile("migrations/Version20260429000000.php")).toBe("migration");
    expect(categorizeFile("db/migrate/20260429000000_create_accounts.rb")).toBe("migration");
    expect(categorizeFile("config/routes.rb")).toBe("route");
    expect(categorizeFile("spec/models/account_spec.rb")).toBe("test");
    expect(categorizeFile("accounts/models.py")).toBe("model");
    expect(categorizeFile("accounts/views.py")).toBe("controller");
    expect(categorizeFile("accounts/serializers.py")).toBe("resource");
    expect(categorizeFile("accounts/forms.py")).toBe("request");
    expect(categorizeFile("demo/urls.py")).toBe("route");
    expect(categorizeFile("app/routers/accounts.py")).toBe("api-route");
    expect(categorizeFile("api/accounts.py")).toBe("api-route");
    expect(categorizeFile("demo/settings.py")).toBe("config");
    expect(categorizeFile("accounts/migrations/0001_initial.py")).toBe("migration");
    expect(categorizeFile("accounts/tests.py")).toBe("test");
    expect(categorizeFile("src/routes/accounts.ts")).toBe("api-route");
    expect(categorizeFile("src/middleware/requireAuth.ts")).toBe("middleware");
    expect(categorizeFile("src/schemas/accountSchema.ts")).toBe("schema");
    expect(categorizeFile("src/accounts/accounts.module.ts")).toBe("module");
    expect(categorizeFile("src/accounts/accounts.controller.ts")).toBe("controller");
    expect(categorizeFile("src/accounts/accounts.service.ts")).toBe("service");
    expect(categorizeFile("resources/js/Pages/Dashboard.vue")).toBe("frontend-page");
    expect(categorizeFile("app/page.tsx")).toBe("frontend-page");
    expect(categorizeFile("app/account/page.tsx")).toBe("frontend-page");
    expect(categorizeFile("app/api/accounts/route.ts")).toBe("api-route");
    expect(categorizeFile("src/hooks/useAccount.ts")).toBe("frontend-hook");
    expect(categorizeFile("pages/accounts/index.vue")).toBe("frontend-route");
    expect(categorizeFile("layouts/default.vue")).toBe("frontend-layout");
    expect(categorizeFile("components/AccountSummary.vue")).toBe("frontend-component");
    expect(categorizeFile("composables/useAccount.ts")).toBe("frontend-composable");
    expect(categorizeFile("app/routes/accounts.tsx")).toBe("frontend-route");
    expect(categorizeFile("app/root.tsx")).toBe("frontend-layout");
    expect(categorizeFile("src/pages/index.astro")).toBe("frontend-route");
    expect(categorizeFile("src/content/posts/welcome.md")).toBe("frontend-content");
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

  test("extracts Ruby classes and methods", () => {
    const symbols = extractSymbols(
      "app/models/account.rb",
      "class Account\n  def active?\n  end\nend\n",
    );
    expect(symbols.map((symbol) => symbol.name)).toContain("Account");
    expect(symbols.map((symbol) => symbol.name)).toContain("active?");
  });

  test("extracts Python classes and functions", () => {
    const symbols = extractSymbols(
      "accounts/models.py",
      "class Account:\n    def is_active(self):\n        return True\n",
    );
    expect(symbols.map((symbol) => symbol.name)).toContain("Account");
    expect(symbols.map((symbol) => symbol.name)).toContain("is_active");
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

    const nodeHttpFiles = await scanRepository(nodeHttpFixture);
    const apiRoute = nodeHttpFiles.find((file) => file.path === "src/routes/accounts.ts");
    expect(apiRoute?.dependencies).toContain("src/middleware/requireAuth.ts");
    expect(apiRoute?.dependencies).toContain("src/handlers/getAccount.ts");
    expect(apiRoute?.dependencies).toContain("src/schemas/accountSchema.ts");

    const nestFiles = await scanRepository(nestFixture);
    const controller = nestFiles.find(
      (file) => file.path === "src/accounts/accounts.controller.ts",
    );
    expect(controller?.dependencies).toContain("src/accounts/accounts.service.ts");

    const astroFiles = await scanRepository(astroFixture);
    const astroPage = astroFiles.find((file) => file.path === "src/pages/index.astro");
    expect(astroPage?.language).toBe("astro");
    expect(astroPage?.dependencies).toContain("src/components/Hero.astro");

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
