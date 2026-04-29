import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
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
    const result = Bun.spawnSync({
      cmd: ["bun", "run", cli, "explain", "app/Jobs/SendSourceOfFundsReminderJob.php", "--json"],
      cwd: fixture,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);
    const payload = JSON.parse(new TextDecoder().decode(result.stdout));
    expect(payload.path).toBe("app/Jobs/SendSourceOfFundsReminderJob.php");
    expect(payload.category).toBe("job");
    expect(payload.relatedTests[0].path).toBe("tests/Feature/SourceOfFundsReminderTest.php");
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
