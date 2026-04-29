#!/usr/bin/env bun
import { initCommand } from "./commands/init";
import { indexCommand } from "./commands/index";
import { mapCommand } from "./commands/map";
import { packCommand } from "./commands/pack";
import { testsForCommand } from "./commands/tests-for";
import { diffRiskCommand } from "./commands/diff-risk";
import { handoffCommand } from "./commands/handoff";
import { rulesCommand } from "./commands/rules";
import { explainCommand } from "./commands/explain";
import { staleCommand } from "./commands/stale";

export interface CliArgs {
  command: string;
  positionals: string[];
  flags: Set<string>;
  values: Map<string, string>;
}

function parse(argv: string[]): CliArgs {
  const [command = "help", ...rest] = argv;
  const positionals: string[] = [];
  const flags = new Set<string>();
  const values = new Map<string, string>();

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const [name, inlineValue] = arg.slice(2).split("=", 2);
      if (!name) continue;
      if (inlineValue != null) {
        values.set(name, inlineValue);
      } else if (
        rest[index + 1] &&
        !rest[index + 1]?.startsWith("--") &&
        ["output", "files"].includes(name)
      ) {
        values.set(name, rest[index + 1] ?? "");
        index += 1;
      } else {
        flags.add(name);
      }
    } else {
      positionals.push(arg);
    }
  }
  return { command, positionals, flags, values };
}

async function main(): Promise<void> {
  const args = parse(Bun.argv.slice(2));
  const root = process.cwd();

  switch (args.command) {
    case "init":
      await initCommand(root);
      break;
    case "index":
      await indexCommand(root);
      break;
    case "map":
      await mapCommand(root, args);
      break;
    case "pack":
      await packCommand(root, args);
      break;
    case "tests-for":
      await testsForCommand(root, args);
      break;
    case "diff-risk":
      await diffRiskCommand(root, args);
      break;
    case "rules":
      await rulesCommand(root, args);
      break;
    case "handoff":
      await handoffCommand(root, args);
      break;
    case "explain":
      await explainCommand(root, args);
      break;
    case "stale":
      await staleCommand(root, args);
      break;
    case "help":
    default:
      printHelp();
  }
}

function printHelp(): void {
  console.log(`ctx

Usage:
  ctx init
  ctx index
  ctx map [--json]
  ctx pack <task> [--json|--markdown] [--changed] [--small|--full] [--files n] [--include-symbols] [--output path]
  ctx tests-for <file|--changed>
  ctx diff-risk [--json]
  ctx rules [--json]
  ctx explain <file> [--json]
  ctx stale [--json]
  ctx handoff [--stdout|--json]
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
