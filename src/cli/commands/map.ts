import type { CliArgs } from "../index";
import { json, renderProjectMap } from "../../core/output";
import { detectProject } from "../../core/project";

export async function mapCommand(root: string, args: CliArgs): Promise<void> {
  const project = await detectProject(root);
  console.log(args.flags.has("json") ? json(project) : renderProjectMap(project));
}
