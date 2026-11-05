/**
 * This script measures the sizes of the built package, and writes `src/data/size.json` and `public/data-stamps.json`.
 * The Pages workflow starts it after the build of the package and before the build of the site.
 * A budget that fails does not stop this script: the job of CI holds the budgets, and the page shows the true size.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSizes, sizeStamps } from "../src/lib/size-stamps.ts";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repository, GITHUB_RUN_ID: runId } = process.env;
if (!server || !repository || !runId) throw new Error("The data stamps name a run of GitHub Actions, and this environment has none.");

const result = spawnSync("pnpm", ["--filter", "ireko", "exec", "size-limit", "--json"], { cwd: site, encoding: "utf8" });
if (result.error) throw result.error;
const file = parseSizes(result.stdout);
const { version } = JSON.parse(readFileSync(join(site, "../ireko/package.json"), "utf8")) as { version: string };
const stamps = sizeStamps({ id: runId, url: `${server}/${repository}/actions/runs/${runId}`, date: new Date().toISOString(), engines: { ireko: version } });

writeFileSync(join(site, "src/data/size.json"), `${JSON.stringify(file, null, 2)}\n`);
writeFileSync(join(site, "public/data-stamps.json"), `${JSON.stringify(stamps, null, 2)}\n`);
console.log(`The sizes of ireko ${version}: ${JSON.stringify(file.sizes)}`);
