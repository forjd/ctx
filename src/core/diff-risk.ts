import type { DiffRiskReport } from "../types";
import { changedFiles } from "./git";

export async function analyzeDiffRisk(root: string, files?: string[]): Promise<DiffRiskReport> {
  const changed = files ?? (await changedFiles(root));
  const areas = new Set<string>();
  const concerns = new Set<string>();
  const checks = new Set<string>();
  const hasTests = changed.some(
    (file) => file.startsWith("tests/") || /(\.test|\.spec)\./.test(file),
  );

  for (const file of changed) {
    const lower = file.toLowerCase();
    if (file.includes("database/migrations/")) {
      areas.add("Migration");
      checks.add("php artisan migrate:fresh --seed");
      if (!hasTests) concerns.add("Migration changed but no matching test changed.");
    }
    if (file.includes("app/Jobs/")) {
      areas.add("Queue job");
      concerns.add("Queue job changed; check tries/backoff behaviour.");
    }
    if (file.includes("app/Notifications/")) {
      areas.add("Notification");
      concerns.add("Notification changed; verify no sensitive financial data is included.");
    }
    if (file.includes("app/Policies/") || lower.includes("auth") || lower.includes("gate")) {
      areas.add("Authorization");
      concerns.add("Authorization-related code changed; verify access boundaries.");
    }
    if (file.includes("app/Http/Requests/")) {
      areas.add("Validation request");
      if (!hasTests) concerns.add("Request validation changed but no feature test changed.");
    }
    if (file.includes("app/Http/Resources/")) areas.add("API resource");
    if (file.includes("config/") || lower.includes(".env")) {
      areas.add("Configuration");
      concerns.add("Configuration changed; verify environment-specific behaviour.");
    }
    if (file.includes("app/Enums/")) {
      areas.add("Enum");
      if (!hasTests) concerns.add("Enum changed but no tests changed.");
    }
    if (/(payment|money|amount|currency|financial|source.?of.?funds)/i.test(file)) {
      areas.add("Money or financial domain");
      concerns.add(
        "Money-related file changed; check rounding, idempotency, and sensitive data handling.",
      );
    }
    if (/(casts|cast)/i.test(file)) {
      areas.add("Database casts");
      concerns.add("Database cast behaviour changed; verify serialization and persisted values.");
    }
  }

  const riskLevel =
    concerns.size >= 3 || areas.has("Migration") || areas.has("Authorization")
      ? "high"
      : concerns.size > 0
        ? "medium"
        : "low";
  const filter = domainFilter(changed);
  if (filter) checks.add(`php artisan test --filter=${filter}`);

  return {
    riskLevel,
    changedFiles: changed,
    changedAreas: [...areas],
    concerns: [...concerns],
    suggestedChecks: [...checks],
  };
}

function domainFilter(files: string[]): string {
  const names = files
    .map((file) => file.split("/").at(-1) ?? "")
    .map((file) => file.replace(/\.[^.]+$/, ""))
    .filter(Boolean);
  const source = names.find((name) => /[A-Z]/.test(name)) ?? names[0] ?? "";
  return source
    .split(/(?=[A-Z])|[_-]/)
    .filter((part) => part.length > 3)
    .slice(0, 2)
    .join("");
}
