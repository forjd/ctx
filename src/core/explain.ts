import type { FileExplanation, IndexedFile, Rule } from "../types";
import { recommendTests } from "./scorer";

export function explainFile(path: string, files: IndexedFile[], rules: Rule[]): FileExplanation {
  const file = files.find((candidate) => candidate.path === path);
  if (!file) throw new Error(`File is not indexed: ${path}`);

  return {
    path: file.path,
    category: file.category,
    language: file.language,
    isTest: file.isTest,
    isGenerated: file.isGenerated,
    symbols: file.symbols,
    dependencies: file.dependencies,
    dependents: files
      .filter((candidate) => candidate.dependencies.includes(file.path))
      .map((candidate) => candidate.path)
      .sort(),
    relatedTests: recommendTests(files, [file.path]),
    applicableRules: rules.filter((rule) => appliesToFile(rule, file)).slice(0, 8),
    reasons: explanationReasons(file),
  };
}

function explanationReasons(file: IndexedFile): string[] {
  const reasons = [
    `Categorized as ${file.category} from its path.`,
    `Detected language ${file.language} from extension ${file.extension || "none"}.`,
  ];
  if (file.isTest) reasons.push("Marked as a test by path or filename convention.");
  if (file.isGenerated) reasons.push("Marked generated or dependency-like and will rank poorly.");
  if (file.symbols.length) reasons.push(`Extracted ${file.symbols.length} lightweight symbols.`);
  return reasons;
}

function appliesToFile(rule: Rule, file: IndexedFile): boolean {
  const text = `${rule.text} ${rule.source}`.toLowerCase();
  if (text.includes("generated") || text.includes("dependency")) return true;
  if (file.language === "php" && /pest|php|laravel|migration/.test(text)) return true;
  if (file.language === "vue" && /vue|component/.test(text)) return true;
  if (file.language === "typescript" && /typescript|typed|vue|test/.test(text)) return true;
  if (file.category === "migration" && text.includes("migration")) return true;
  if (file.category.includes("test") && /test|pest/.test(text)) return true;
  return false;
}
