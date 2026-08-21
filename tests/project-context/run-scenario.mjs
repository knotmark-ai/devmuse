import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const index = process.argv.indexOf("--scenario");
if (index >= 0) {
  const name = process.argv[index + 1];
  if (!name) throw new Error("--scenario requires a name");
  const { scenarios } = await import("./scenarios.mjs");
  if (!scenarios[name]) throw new Error(`unknown project-context scenario: ${name}`);
  await scenarios[name]();
  console.log(`PASS: project-context scenario ${name}`);
} else {
  const files = fs.readdirSync(directory)
    .filter((file) => file.endsWith(".test.mjs"))
    .sort()
    .map((file) => path.join(directory, file));
  const githubFirstContract = path.join(root, "tests/github-first-contract/run-test.mjs");
  if (fs.existsSync(githubFirstContract)) files.push(githubFirstContract);
  const result = spawnSync(process.execPath, ["--test", ...files], { cwd: root, stdio: "inherit" });
  process.exitCode = result.status ?? 1;
}
