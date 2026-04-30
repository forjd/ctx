import type { CliArgs } from "./index";

export function wantsJson(args: CliArgs): boolean {
  return args.flags.has("json") || args.flags.has("agent");
}

export function wantsAgent(args: CliArgs): boolean {
  return args.flags.has("agent");
}
