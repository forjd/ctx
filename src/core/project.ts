import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Framework, ProjectInfo } from "../types";
import { hasAnyFileWithExtension } from "./scanner";

async function fileContains(path: string, text: string): Promise<boolean> {
  if (!existsSync(path)) return false;
  return (await readFile(path, "utf8")).includes(text);
}

function packageHas(raw: string, name: string): boolean {
  return raw.includes(`"${name}"`);
}

export async function detectProject(root: string): Promise<ProjectInfo> {
  const frameworks = new Set<Framework>();
  const composer = join(root, "composer.json");
  const packageJson = join(root, "package.json");
  const gemfile = join(root, "Gemfile");
  const requirements = join(root, "requirements.txt");
  const pyproject = join(root, "pyproject.toml");
  const packageRaw = existsSync(packageJson) ? await readFile(packageJson, "utf8") : "";

  if (
    existsSync(join(root, "artisan")) ||
    existsSync(join(root, "app/Http")) ||
    existsSync(join(root, "routes/web.php")) ||
    existsSync(join(root, "routes/api.php")) ||
    (await fileContains(composer, "laravel/framework"))
  ) {
    frameworks.add("laravel");
  }

  if (
    existsSync(join(root, "bin/console")) ||
    existsSync(join(root, "config/packages")) ||
    existsSync(join(root, "src/Controller")) ||
    (await fileContains(composer, "symfony/framework-bundle"))
  ) {
    frameworks.add("symfony");
  }

  if (existsSync(packageJson)) frameworks.add("node");
  if (packageHas(packageRaw, "express")) frameworks.add("express");
  if (packageHas(packageRaw, "fastify")) frameworks.add("fastify");
  if (packageHas(packageRaw, "hono")) frameworks.add("hono");
  if (packageHas(packageRaw, "@nestjs/core") || packageHas(packageRaw, "@nestjs/common"))
    frameworks.add("nestjs");
  if (packageHas(packageRaw, "@remix-run/react") || packageHas(packageRaw, "@remix-run/node"))
    frameworks.add("remix");
  if (
    packageHas(packageRaw, "react-router") ||
    existsSync(join(root, "react-router.config.ts")) ||
    existsSync(join(root, "react-router.config.js"))
  )
    frameworks.add("react-router");
  if (
    packageHas(packageRaw, "astro") ||
    existsSync(join(root, "astro.config.js")) ||
    existsSync(join(root, "astro.config.ts")) ||
    (await hasAnyFileWithExtension(root, ".astro"))
  )
    frameworks.add("astro");
  if (
    (await fileContains(gemfile, "rails")) ||
    existsSync(join(root, "config/application.rb")) ||
    existsSync(join(root, "app/controllers"))
  )
    frameworks.add("rails");
  if (
    existsSync(join(root, "manage.py")) ||
    (await fileContains(requirements, "Django")) ||
    (await fileContains(requirements, "django")) ||
    (await fileContains(pyproject, "django"))
  )
    frameworks.add("django");
  if (
    packageHas(packageRaw, "vue") ||
    packageHas(packageRaw, "nuxt") ||
    existsSync(join(root, "resources/js")) ||
    existsSync(join(root, "vite.config.ts")) ||
    existsSync(join(root, "vite.config.js")) ||
    (await hasAnyFileWithExtension(root, ".vue"))
  ) {
    frameworks.add("vue");
  }
  if (
    packageHas(packageRaw, "react") ||
    existsSync(join(root, "src/App.tsx")) ||
    existsSync(join(root, "src/App.jsx"))
  ) {
    frameworks.add("react");
  }
  if (
    packageHas(packageRaw, "next") ||
    existsSync(join(root, "next.config.js")) ||
    existsSync(join(root, "next.config.ts")) ||
    existsSync(join(root, "app/page.tsx")) ||
    existsSync(join(root, "src/app/page.tsx"))
  ) {
    frameworks.add("next");
    frameworks.add("react");
  }
  if (
    packageHas(packageRaw, "nuxt") ||
    existsSync(join(root, "nuxt.config.js")) ||
    existsSync(join(root, "nuxt.config.ts")) ||
    existsSync(join(root, "app.vue"))
  ) {
    frameworks.add("nuxt");
    frameworks.add("vue");
  }
  if (
    packageHas(packageRaw, "svelte") ||
    existsSync(join(root, "svelte.config.js")) ||
    existsSync(join(root, "svelte.config.ts")) ||
    (await hasAnyFileWithExtension(root, ".svelte"))
  ) {
    frameworks.add("svelte");
  }
  if (
    packageHas(packageRaw, "@sveltejs/kit") ||
    existsSync(join(root, "src/routes")) ||
    existsSync(join(root, "src/app.html"))
  ) {
    frameworks.add("sveltekit");
    frameworks.add("svelte");
  }
  if (
    existsSync(join(root, "tsconfig.json")) ||
    (await hasAnyFileWithExtension(root, ".ts")) ||
    (await hasAnyFileWithExtension(root, ".tsx"))
  ) {
    frameworks.add("typescript");
  }
  if (existsSync(join(root, "pest.php")) || (await fileContains(composer, "pestphp/pest"))) {
    frameworks.add("pest");
  }

  return {
    root,
    frameworks: [...frameworks],
    packageManager: detectPackageManager(root),
    importantDirectories: importantDirectories(root),
    conventions: conventions([...frameworks]),
  };
}

function detectPackageManager(root: string): ProjectInfo["packageManager"] {
  if (existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb"))) return "bun";
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  return "npm";
}

function importantDirectories(root: string): string[] {
  return [
    "app/Models",
    "src/Entity",
    "app/models",
    "app/Http/Controllers",
    "src/Controller",
    "app/controllers",
    "app/Services",
    "app/Jobs",
    "app/Notifications",
    "database/migrations",
    "db/migrate",
    "tests/Feature",
    "spec",
    "test",
    "resources/js",
    "src",
    "app",
    "pages",
    "components",
  ].filter((path) => existsSync(join(root, path)));
}

function conventions(frameworks: Framework[]): string[] {
  const rules: string[] = [];
  if (frameworks.includes("pest")) rules.push("Uses Pest tests");
  if (frameworks.includes("symfony")) rules.push("Uses Symfony application conventions");
  if (frameworks.includes("vue")) rules.push("Uses Vue frontend");
  if (frameworks.includes("react")) rules.push("Uses React frontend");
  if (frameworks.includes("next")) rules.push("Uses Next.js routing");
  if (frameworks.includes("express")) rules.push("Uses Express HTTP routes");
  if (frameworks.includes("fastify")) rules.push("Uses Fastify HTTP routes");
  if (frameworks.includes("hono")) rules.push("Uses Hono HTTP routes");
  if (frameworks.includes("nestjs")) rules.push("Uses NestJS modules and providers");
  if (frameworks.includes("remix")) rules.push("Uses Remix route modules");
  if (frameworks.includes("react-router")) rules.push("Uses React Router route modules");
  if (frameworks.includes("astro")) rules.push("Uses Astro pages and content collections");
  if (frameworks.includes("rails")) rules.push("Uses Rails application conventions");
  if (frameworks.includes("django")) rules.push("Uses Django application conventions");
  if (frameworks.includes("nuxt")) rules.push("Uses Nuxt routing and server conventions");
  if (frameworks.includes("svelte")) rules.push("Uses Svelte frontend");
  if (frameworks.includes("sveltekit")) rules.push("Uses SvelteKit routing");
  if (frameworks.includes("laravel")) {
    rules.push("Uses Laravel migrations");
    rules.push("Uses Laravel application structure");
  }
  if (frameworks.includes("typescript")) rules.push("Uses TypeScript");
  return rules;
}
