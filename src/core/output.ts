import type {
  ContextPack,
  DiffRiskReport,
  FileExplanation,
  ProjectInfo,
  Rule,
  TestRecommendation,
} from "../types";

export function json(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function renderProjectMap(project: ProjectInfo): string {
  return [
    "# Project Map",
    "",
    "## Detected stack",
    ...bullets(project.frameworks.length ? project.frameworks.map(title) : ["Unknown"]),
    "",
    "## Important directories",
    ...bullets(
      project.importantDirectories.length ? project.importantDirectories : ["None detected"],
    ),
    "",
    "## Detected conventions",
    ...bullets(
      project.conventions.length ? project.conventions : ["No specific conventions detected"],
    ),
    "",
  ].join("\n");
}

export function renderRules(rules: Rule[]): string {
  return [
    "# Project Rules",
    "",
    ...bullets(rules.map((rule) => `${rule.text} (${rule.source})`)),
    "",
  ].join("\n");
}

export function renderTests(
  titleText: string,
  direct: TestRecommendation[],
  broader: string[],
  reasoning: string[],
): string {
  return [
    `# ${titleText}`,
    "",
    "## Direct",
    ...bullets(direct.map((test) => `${test.command}\n  Reason: ${test.reason}`)),
    "",
    "## Broader",
    ...bullets(broader),
    "",
    "## Reasoning",
    ...bullets(reasoning),
    "",
  ].join("\n");
}

export function renderContextPack(pack: ContextPack, history: string[] = []): string {
  return [
    "# Context Pack",
    "",
    "## Task",
    "",
    pack.task,
    "",
    "## Relevant files",
    "",
    ...pack.files.flatMap((file) => [
      `### ${file.path}`,
      "",
      `Reason: ${file.reason}`,
      ...(file.symbols?.length
        ? [
            "",
            "Symbols:",
            ...bullets(file.symbols.map((symbol) => `${symbol.kind} ${symbol.name}`)),
          ]
        : []),
      "",
    ]),
    ...(pack.changedFiles?.length
      ? ["## Changed files", "", ...bullets(pack.changedFiles), ""]
      : []),
    "## Relevant tests",
    "",
    ...bullets(
      pack.tests.map(
        (test) => `${test.path}\n  Command: ${test.command}\n  Reason: ${test.reason}`,
      ),
    ),
    "",
    "## Dependency edges",
    "",
    ...bullets(
      pack.dependencyEdges.length
        ? pack.dependencyEdges.map((edge) => `${edge.from} -> ${edge.to}\n  Reason: ${edge.reason}`)
        : ["No dependency edges found for ranked files."],
    ),
    "",
    "## Project rules",
    "",
    ...bullets(pack.rules.map((rule) => `${rule.text} (${rule.source})`)),
    "",
    "## Relevant Git history",
    "",
    ...bullets(history.length ? history : ["No matching recent Git history found."]),
    "",
    "## Risk notes",
    "",
    ...bullets(pack.risks.map((risk) => `${title(risk.level)}: ${risk.text}`)),
    "",
    "## Suggested commands",
    "",
    ...bullets(pack.suggestedCommands),
    "",
    "## Next actions",
    "",
    ...pack.nextActions.map((action, index) => `${index + 1}. ${action}`),
    "",
  ].join("\n");
}

export function renderDiffRisk(report: DiffRiskReport): string {
  return [
    "# Diff Risk Report",
    "",
    `Risk level: ${title(report.riskLevel)}`,
    "",
    "## Changed areas",
    ...bullets(report.changedAreas.length ? report.changedAreas : ["None"]),
    "",
    "## Concerns",
    ...bullets(report.concerns.length ? report.concerns : ["No notable risk signals detected."]),
    "",
    "## Suggested checks",
    ...bullets(
      report.suggestedChecks.length
        ? report.suggestedChecks
        : ["Run the project's standard test suite."],
    ),
    "",
  ].join("\n");
}

export function renderFileExplanation(report: FileExplanation): string {
  return [
    "# File Explanation",
    "",
    `Path: ${report.path}`,
    `Category: ${report.category}`,
    `Language: ${report.language}`,
    `Test: ${report.isTest ? "yes" : "no"}`,
    `Generated: ${report.isGenerated ? "yes" : "no"}`,
    "",
    "## Reasons",
    ...bullets(report.reasons),
    "",
    "## Symbols",
    ...bullets(
      report.symbols.length
        ? report.symbols.map((symbol) => `${symbol.kind} ${symbol.name}:${symbol.lineStart}`)
        : ["No symbols extracted."],
    ),
    "",
    "## Dependencies",
    ...bullets(report.dependencies.length ? report.dependencies : ["No dependencies resolved."]),
    "",
    "## Dependents",
    ...bullets(report.dependents.length ? report.dependents : ["No dependents resolved."]),
    "",
    "## Related tests",
    ...bullets(
      report.relatedTests.length
        ? report.relatedTests.map((test) => `${test.path}\n  Command: ${test.command}`)
        : ["No related tests found."],
    ),
    "",
    "## Applicable rules",
    ...bullets(
      report.applicableRules.length
        ? report.applicableRules.map((rule) => `${rule.text} (${rule.source})`)
        : ["No specific rules matched."],
    ),
    "",
  ].join("\n");
}

function bullets(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
