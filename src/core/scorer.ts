import type { Framework, IndexedFile, RankedFile, TestRecommendation } from "../types";

const synonymMap: Record<string, string[]> = {
  "source-of-funds": ["source of funds", "source_of_funds", "sourcefunds", "sourceoffunds", "sof"],
  source_of_funds: ["source of funds", "source-of-funds", "sourcefunds", "sourceoffunds", "sof"],
  expiry: ["expires", "expired", "expiration", "expiring", "expire"],
  reminders: ["reminder", "notification", "notify", "email", "mail"],
  reminder: ["reminders", "notification", "notify", "email", "mail"],
  "anti-money-laundering": ["aml", "anti money laundering", "anti_money_laundering"],
  money: ["payment", "payments", "amount", "currency", "financial"],
};

const categoryBoosts: Record<string, string[]> = {
  reminder: ["job", "notification", "feature-test", "unit-test"],
  reminders: ["job", "notification", "feature-test", "unit-test"],
  expiry: ["model", "migration", "enum", "job", "feature-test"],
  validation: ["request", "feature-test"],
  policy: ["policy", "feature-test"],
  controller: ["controller", "route", "feature-test"],
  frontend: ["frontend-page", "frontend-component"],
  vue: ["frontend-page", "frontend-component"],
};

const stopWords = new Set([
  "add",
  "app",
  "and",
  "component",
  "components",
  "composable",
  "composables",
  "controller",
  "controllers",
  "for",
  "from",
  "handle",
  "handling",
  "http",
  "into",
  "page",
  "pages",
  "resource",
  "resources",
  "service",
  "services",
  "the",
  "use",
  "with",
]);

export function taskTerms(task: string): string[] {
  const raw = task
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-z0-9_-]+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
  const expanded = new Set(raw);
  for (const term of raw) {
    expanded.add(term.replace(/[-_]/g, ""));
    expanded.add(term.replace(/[-_]/g, " "));
    for (const synonym of synonymMap[term] ?? []) expanded.add(synonym);
  }
  return [...expanded].filter(Boolean);
}

export function rankFiles(files: IndexedFile[], task: string): RankedFile[] {
  const terms = taskTerms(task);
  const testDomainTerms = terms.filter(
    (term) => !["add", "update", "fix", "the", "for"].includes(term),
  );

  return files
    .map((file) => {
      if (file.isGenerated) {
        return {
          path: file.path,
          score: -100,
          category: file.category,
          reason: "generated or dependency file",
        };
      }

      const pathText = normalise(file.path);
      const contentTerms = terms.filter((term) => file.hash && pathText.includes(normalise(term)));
      let score = 0;
      const reasons: string[] = [];

      const pathMatches = terms.filter((term) => pathText.includes(normalise(term)));
      if (pathMatches.length) {
        score += pathMatches.length * 20;
        reasons.push(`path matches ${joinShort(pathMatches)}`);
      }

      const symbolMatches = file.symbols.filter((symbol) =>
        terms.some((term) => normalise(symbol.name).includes(normalise(term))),
      );
      if (symbolMatches.length) {
        score += symbolMatches.length * 16;
        reasons.push(`symbols match ${joinShort(symbolMatches.map((symbol) => symbol.name))}`);
      }

      if (contentTerms.length) {
        score += Math.min(20, contentTerms.length * 4);
        reasons.push(`filename/domain terms suggest ${joinShort(contentTerms)}`);
      }

      for (const [term, categories] of Object.entries(categoryBoosts)) {
        if (terms.includes(term) && categories.includes(file.category)) {
          score += 12;
          reasons.push(`${file.category} is relevant to ${term} work`);
        }
      }

      if (file.isTest && testDomainTerms.some((term) => pathText.includes(normalise(term)))) {
        score += 18;
        reasons.push("likely related test file");
      }

      if (file.sizeBytes > 250_000) {
        score -= 20;
        reasons.push("large file penalty");
      }
      if (/\.(lock|lockb)$/.test(file.path)) score -= 25;

      return {
        path: file.path,
        score,
        category: file.category,
        reason: reasons.filter(Boolean).join("; ") || `category ${file.category} may be relevant`,
      };
    })
    .filter((file) => file.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 12);
}

export function recommendTests(files: IndexedFile[], targetPaths: string[]): TestRecommendation[] {
  const tests = files.filter((file) => file.isTest && !file.isGenerated);
  const terms = new Set<string>();
  for (const targetPath of targetPaths) {
    for (const token of pathTokens(targetPath)) terms.add(token);
  }

  return tests
    .map((test) => {
      const matches = pathTokens(test.path).filter((token) => terms.has(token));
      const score =
        matches.length * 10 +
        (targetPaths.some((path) => directTestName(path, test.path)) ? 40 : 0);
      return {
        path: test.path,
        command: testCommand(test.path),
        reason: directReason(matches, targetPaths, test.path),
        score,
      };
    })
    .filter((test) => test.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 8)
    .map((test) => ({
      path: test.path,
      command: test.command,
      reason: test.reason,
    }));
}

export function broaderTestCommands(
  taskOrPath: string,
  frameworks: Framework[],
  packageScripts: string[] = [],
): string[] {
  const commands = new Set<string>();
  const subject = taskOrPath.includes("/")
    ? (taskOrPath.split("/").at(-1) ?? taskOrPath).replace(/\.[^.]+$/, "")
    : taskOrPath;
  const filter = pascalish(subject)
    .split(/(?=[A-Z])/)
    .slice(0, 3)
    .join("");
  if (frameworks.includes("laravel"))
    commands.add(filter ? `php artisan test --filter=${filter}` : "php artisan test");
  if (packageScripts.includes("test")) commands.add("bun test");
  if (
    frameworks.includes("node") ||
    frameworks.includes("vue") ||
    frameworks.includes("typescript")
  )
    commands.add("bun test");
  return [...commands];
}

function testCommand(path: string): string {
  if (path.endsWith(".php")) return `php artisan test ${path}`;
  return `bun test ${path}`;
}

function directReason(matches: string[], targets: string[], testPath: string): string {
  if (targets.some((path) => directTestName(path, testPath))) return "Direct filename match.";
  if (matches.length) return `Domain keywords match ${joinShort(matches)}.`;
  return "Likely related test.";
}

function directTestName(targetPath: string, testPath: string): boolean {
  const targetBase =
    targetPath
      .split("/")
      .at(-1)
      ?.replace(/\.[^.]+$/, "")
      .replace(/Test$/, "") ?? "";
  const testBase =
    testPath
      .split("/")
      .at(-1)
      ?.replace(/\.[^.]+$/, "") ?? "";
  return normalise(testBase).includes(normalise(targetBase));
}

function pathTokens(path: string): string[] {
  return path
    .replace(/\.[^.]+$/, "")
    .split(/[/._-]+|(?=[A-Z])/)
    .map((token) => token.toLowerCase())
    .filter(
      (token) =>
        token.length > 2 &&
        !stopWords.has(token) &&
        !["test", "tests", "feature", "unit", "src"].includes(token),
    );
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pascalish(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function joinShort(values: string[]): string {
  return [...new Set(values)].slice(0, 4).join(", ");
}
