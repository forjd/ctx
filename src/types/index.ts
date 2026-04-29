export type Framework = "laravel" | "node" | "vue" | "react" | "next" | "typescript" | "pest";

export type FileCategory =
  | "model"
  | "controller"
  | "service"
  | "action"
  | "job"
  | "notification"
  | "policy"
  | "request"
  | "resource"
  | "migration"
  | "factory"
  | "feature-test"
  | "unit-test"
  | "test"
  | "route"
  | "config"
  | "frontend-page"
  | "frontend-component"
  | "frontend-hook"
  | "api-route"
  | "enum"
  | "unknown";

export interface ProjectConfig {
  version: 1;
  projectName: string | null;
  preferredPackageManager: "bun" | "npm" | "pnpm" | "yarn";
  ignoredDirectories: string[];
  frameworks: {
    laravel: boolean;
    node: boolean;
    vue: boolean;
    react: boolean;
    next: boolean;
  };
  scoring: ScoringConfig;
}

export interface ScoringConfig {
  synonyms: Record<string, string[]>;
  categoryBoosts: Record<string, FileCategory[]>;
  broaderTestCommands: string[];
}

export interface ProjectInfo {
  root: string;
  frameworks: Framework[];
  packageManager: ProjectConfig["preferredPackageManager"];
  importantDirectories: string[];
  conventions: string[];
}

export interface IndexedFile {
  path: string;
  extension: string;
  language: string;
  category: FileCategory;
  sizeBytes: number;
  hash: string;
  mtimeMs: number;
  isTest: boolean;
  isGenerated: boolean;
  symbols: SymbolInfo[];
  dependencies: string[];
}

export interface SymbolInfo {
  name: string;
  kind: string;
  lineStart: number;
  lineEnd?: number;
}

export interface Rule {
  text: string;
  source: string;
  confidence: "low" | "medium" | "high";
}

export interface RankedFile {
  path: string;
  score: number;
  category: FileCategory;
  reason: string;
}

export interface TestRecommendation {
  path: string;
  command: string;
  reason: string;
}

export interface RiskNote {
  level: "low" | "medium" | "high";
  text: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  reason: string;
}

export interface ContextPack {
  task: string;
  generatedAt: string;
  project: {
    root: string;
    frameworks: Framework[];
  };
  files: RankedFile[];
  tests: TestRecommendation[];
  rules: Rule[];
  risks: RiskNote[];
  dependencyEdges: DependencyEdge[];
  suggestedCommands: string[];
  nextActions: string[];
}

export interface DiffRiskReport {
  riskLevel: "low" | "medium" | "high";
  changedFiles: string[];
  changedAreas: string[];
  concerns: string[];
  suggestedChecks: string[];
}

export interface FileExplanation {
  path: string;
  category: FileCategory;
  language: string;
  isTest: boolean;
  isGenerated: boolean;
  symbols: SymbolInfo[];
  dependencies: string[];
  dependents: string[];
  relatedTests: TestRecommendation[];
  applicableRules: Rule[];
  reasons: string[];
}
