import { $ } from "bun";

export async function gitLines(args: string[], cwd: string): Promise<string[]> {
  try {
    const output = await $`git ${args}`.cwd(cwd).quiet().text();
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function gitText(args: string[], cwd: string): Promise<string> {
  try {
    return await $`git ${args}`.cwd(cwd).quiet().text();
  } catch {
    return "";
  }
}

export async function changedFiles(root: string, staged = false): Promise<string[]> {
  return gitLines(staged ? ["diff", "--cached", "--name-only"] : ["diff", "--name-only"], root);
}

export async function currentBranch(root: string): Promise<string> {
  return (await gitText(["branch", "--show-current"], root)).trim() || "unknown";
}

export async function currentHead(root: string): Promise<string> {
  return (await gitText(["rev-parse", "HEAD"], root)).trim();
}

export async function recentCommits(root: string): Promise<string[]> {
  return gitLines(["log", "--oneline", "-5"], root);
}

export async function gitHistoryForTerms(root: string, terms: string[]): Promise<string[]> {
  if (terms.length === 0) return [];
  const grep = terms.slice(0, 5).join("|");
  return gitLines(
    ["log", "--oneline", "--all", "--regexp-ignore-case", `--grep=${grep}`, "-5"],
    root,
  );
}
