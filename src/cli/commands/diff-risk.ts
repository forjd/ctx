import type { CliArgs } from "../index";
import { analyzeDiffRisk } from "../../core/diff-risk";
import { json, renderDiffRisk } from "../../core/output";

export async function diffRiskCommand(root: string, args: CliArgs): Promise<void> {
  const report = await analyzeDiffRisk(root);
  console.log(args.flags.has("json") ? json(report) : renderDiffRisk(report));
}
