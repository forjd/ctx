import type { CliArgs } from "../index";
import { wantsJson } from "../output-mode";
import { analyzeDiffRisk } from "../../core/diff-risk";
import { json, renderDiffRisk } from "../../core/output";

export async function diffRiskCommand(root: string, args: CliArgs): Promise<void> {
  const report = await analyzeDiffRisk(root);
  console.log(wantsJson(args) ? json(report) : renderDiffRisk(report));
}
