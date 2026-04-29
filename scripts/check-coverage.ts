const threshold = Number(process.env.COVERAGE_THRESHOLD ?? "95");
const result = Bun.spawnSync(["bun", "test", "--coverage"], {
  stdout: "pipe",
  stderr: "pipe",
});

const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;
process.stdout.write(output);

if (result.exitCode !== 0) {
  process.exit(result.exitCode);
}

const match = output.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);

if (!match?.[2]) {
  console.error("Could not parse Bun coverage output.");
  process.exit(1);
}

const lineCoverage = Number(match[2]);

if (!Number.isFinite(lineCoverage)) {
  console.error(`Could not parse line coverage from "${match[2]}".`);
  process.exit(1);
}

if (lineCoverage < threshold) {
  console.error(`Line coverage ${lineCoverage}% is below required ${threshold}%.`);
  process.exit(1);
}

console.log(`Line coverage ${lineCoverage}% meets required ${threshold}%.`);
