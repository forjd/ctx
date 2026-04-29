import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectInfo, Rule } from "../types";

export async function inferRules(root: string, project: ProjectInfo): Promise<Rule[]> {
  const rules: Rule[] = [];
  const add = (text: string, source: string, confidence: Rule["confidence"] = "medium") => {
    if (!rules.some((rule) => rule.text === text)) rules.push({ text, source, confidence });
  };

  if (project.frameworks.includes("pest")) add("Use Pest for PHP tests.", "pest.php", "high");
  if (project.frameworks.includes("laravel")) {
    add("Use Laravel migrations for schema changes.", "composer.json", "high");
    add("Run php artisan test for backend changes.", "composer.json", "medium");
    add("Use Laravel jobs for queued work.", "app/Jobs", "medium");
    add("Use notifications for user-facing reminders.", "app/Notifications", "medium");
  }
  if (project.frameworks.includes("symfony")) {
    add(
      "Use Symfony console, controller, service, and entity conventions.",
      "composer.json",
      "high",
    );
    add("Run php bin/phpunit for Symfony changes.", "composer.json", "medium");
  }
  if (
    project.frameworks.includes("express") ||
    project.frameworks.includes("fastify") ||
    project.frameworks.includes("hono")
  )
    add(
      "Keep Node HTTP routes, middleware, handlers, and schemas explicit.",
      "package.json",
      "medium",
    );
  if (project.frameworks.includes("nestjs"))
    add("Keep NestJS modules, controllers, and providers aligned.", "package.json", "high");
  if (project.frameworks.includes("remix") || project.frameworks.includes("react-router"))
    add(
      "Use route modules under app/routes for Remix or React Router changes.",
      "package.json",
      "high",
    );
  if (project.frameworks.includes("astro"))
    add(
      "Use Astro pages and content collections under src/pages and src/content.",
      "astro.config",
      "high",
    );
  if (project.frameworks.includes("rails")) {
    add("Use Rails migrations for schema changes.", "Gemfile", "high");
    add("Run Rails or RSpec tests for backend changes.", "Gemfile", "medium");
  }
  if (project.frameworks.includes("django")) {
    add("Use Django migrations for model schema changes.", "manage.py", "high");
    add("Run python manage.py test for Django changes.", "manage.py", "medium");
  }
  if (project.frameworks.includes("fastapi")) {
    add(
      "Keep FastAPI routers, dependencies, and Pydantic schemas explicit.",
      "pyproject.toml",
      "high",
    );
    add("Run pytest for FastAPI changes.", "pyproject.toml", "medium");
  }
  if (project.frameworks.includes("flask")) {
    add("Keep Flask routes, blueprints, and app setup explicit.", "pyproject.toml", "high");
    add("Run pytest for Flask changes.", "pyproject.toml", "medium");
  }
  if (project.frameworks.includes("go")) {
    add("Keep Go packages small and test package behaviour with go test.", "go.mod", "high");
    add("Run go test ./... for Go changes.", "go.mod", "medium");
  }
  if (project.frameworks.includes("wordpress")) {
    add("Keep WordPress plugin hooks and theme templates explicit.", "wp-content", "high");
    add("Run PHPUnit for WordPress plugin or theme changes.", "composer.json", "medium");
  }
  if (project.frameworks.includes("drupal")) {
    add("Keep Drupal module routing, services, and config YAML aligned.", "composer.json", "high");
    add("Run PHPUnit for Drupal module or theme changes.", "composer.json", "medium");
  }
  if (project.frameworks.includes("vue"))
    add("Use Vue components under resources/js or src/components.", "package.json", "high");
  if (project.frameworks.includes("react"))
    add("Use React components for frontend UI changes.", "package.json", "medium");
  if (project.frameworks.includes("next"))
    add("Respect Next.js app or pages routing conventions.", "package.json", "high");
  if (project.frameworks.includes("nuxt"))
    add(
      "Use Nuxt conventions for pages, layouts, composables, and server routes.",
      "nuxt.config",
      "high",
    );
  if (project.frameworks.includes("svelte"))
    add(
      "Use Svelte components under src/lib/components or framework routes.",
      "package.json",
      "high",
    );
  if (project.frameworks.includes("sveltekit"))
    add("Use SvelteKit route conventions under src/routes.", "svelte.config", "high");
  if (project.frameworks.includes("typescript"))
    add(
      "Respect the TypeScript configuration before changing typed code.",
      "tsconfig.json",
      "medium",
    );
  add("Do not edit generated files or dependency directories.", "ctx", "high");

  await addDocumentRules(root, add);
  return rules;
}

async function addDocumentRules(
  root: string,
  add: (text: string, source: string, confidence?: Rule["confidence"]) => void,
): Promise<void> {
  const docs = [
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "pint.json",
    "eslint.config.js",
    "eslint.config.ts",
    "phpunit.xml",
  ];
  for (const doc of docs) {
    const path = join(root, doc);
    if (!existsSync(path)) continue;
    const raw = await readFile(path, "utf8").catch(() => "");
    const lower = raw.toLowerCase();
    if (lower.includes("conventional commit"))
      add("Use Conventional Commits for commit messages.", doc, "medium");
    if (lower.includes("pest")) add("Use Pest for PHP tests.", doc, "medium");
    if (lower.includes("pint")) add("Use Laravel Pint formatting for PHP code.", doc, "medium");
  }
  const cursorRules = join(root, ".cursor/rules");
  if (existsSync(cursorRules)) {
    const entries = await readdir(cursorRules).catch(() => []);
    for (const entry of entries)
      add(
        `Review .cursor/rules/${entry} before related edits.`,
        `.cursor/rules/${entry}`,
        "medium",
      );
  }
  const docsDir = join(root, "docs");
  if (existsSync(docsDir)) add("Review docs/ for domain-specific project guidance.", "docs", "low");
}
