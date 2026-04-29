import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const cli = join(root, "src/cli/index.ts");
const tempRoots: string[] = [];

afterEach(async () => {
  for (const path of tempRoots.splice(0)) {
    await rm(path, { recursive: true, force: true });
  }
});

describe("cli commands", () => {
  test("explain prints file details from the real CLI", async () => {
    const fixture = await copyFixture("laravel-basic");
    const result = runCli(fixture, [
      "explain",
      "app/Jobs/SendSourceOfFundsReminderJob.php",
      "--json",
    ]);

    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.path).toBe("app/Jobs/SendSourceOfFundsReminderJob.php");
    expect(payload.category).toBe("job");
    expect(payload.dependencies).toContain("app/Models/SourceOfFundsRequest.php");
    expect(payload.relatedTests[0].path).toBe("tests/Feature/SourceOfFundsReminderTest.php");
  });

  test("stale reports missing and fresh indexes from the real CLI", async () => {
    const fixture = await copyFixture("laravel-basic");
    const missing = runCli(fixture, ["stale", "--json"]);
    expect(missing.exitCode).toBe(0);
    expect(JSON.parse(missing.stdout).isStale).toBe(true);

    const index = runCli(fixture, ["index"]);
    expect(index.exitCode).toBe(0);

    const fresh = runCli(fixture, ["stale", "--json"]);
    expect(fresh.exitCode).toBe(0);
    const payload = JSON.parse(fresh.stdout);
    expect(payload.isStale).toBe(false);
    expect(typeof payload.indexedAt).toBe("string");
  });

  test("pack uses configured scoring from the real CLI", async () => {
    const fixture = await copyFixture("laravel-basic");
    await mkdir(join(fixture, ".ctx"), { recursive: true });
    await writeFile(
      join(fixture, ".ctx/config.json"),
      `${JSON.stringify(
        {
          scoring: {
            synonyms: { aml: ["source-of-funds"] },
            categoryBoosts: { aml: ["model"] },
            broaderTestCommands: ["bun run custom:test"],
          },
        },
        null,
        2,
      )}\n`,
    );

    const result = runCli(fixture, ["pack", "review aml cases", "--json"]);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.files[0].path).toContain("SourceOfFunds");
    expect(payload.suggestedCommands).toContain("bun run custom:test");
  });

  test("map detects Next from the real CLI", async () => {
    const fixture = await copyFixture("next-basic");
    const result = runCli(fixture, ["map", "--json"]);
    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.frameworks).toContain("next");
    expect(payload.frameworks).toContain("react");
  });
});

async function copyFixture(name: string): Promise<string> {
  const destination = await mkdtemp(join(tmpdir(), `ctx-${name}-`));
  tempRoots.push(destination);
  const source = join(root, "tests/fixtures", name);
  const result = Bun.spawnSync({
    cmd: ["cp", "-R", `${source}/.`, destination],
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr));
  }
  return destination;
}

function runCli(cwd: string, args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", cli, ...args],
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}
