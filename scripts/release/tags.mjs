// Plans the git tag and the GitHub release of ireko, for the tag job of release.yml.
//
//   node scripts/release/tags.mjs <file>
//
// The shared build job (reusable-release-build.yml of the template) runs this script, and the tag
// job (reusable-release-tag.yml) reads <file>. That job holds "contents: write" and runs no code of
// the repository. Thus this script runs in the build job ("contents: read") and makes all the text
// of the release.
//
// This repository keeps its own tags.mjs. The tags.mjs of the template gives no title and no
// tarball, and it does not stop a release without a changelog section. <file> is a JSON array with
// one entry, for the package ireko:
//
//   tag         "v<version>".
//   title       "ireko <version>".
//   prerelease  true for a version with a prerelease part, for example 0.2.0-beta.1.
//   notes       The section of the version in packages/ireko/CHANGELOG.md
//               (packages/ireko/scripts/changelog.mjs). Without that section, the script fails, and
//               the release stops before the publish.
//   tarballs    ["ireko"]: the GitHub release gets the tarball of ireko as a file.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseVersion, publishedPackages, root } from "./workspace.mjs";

const NAME = "ireko";

const out = process.argv[2];
if (out === undefined) {
  process.stderr.write("usage: node scripts/release/tags.mjs <file>\n");
  process.exit(2);
}

const entry = publishedPackages().find(({ manifest }) => manifest.name === NAME);
if (entry === undefined) {
  process.stderr.write(`${NAME} is not a published package of this repository.\n`);
  process.exit(1);
}
const { version } = entry.manifest;

// changelog.mjs prints the section of the version. It exits with 1 when the section is missing or empty.
let notes;
try {
  notes = execFileSync(process.execPath, [join(root, "packages", "ireko", "scripts", "changelog.mjs"), version], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
} catch {
  process.stderr.write(`Add the section of ${version} to packages/ireko/CHANGELOG.md before the release.\n`);
  process.exit(1);
}

const plan = [
  {
    name: NAME,
    version,
    tag: `v${version}`,
    prerelease: (parseVersion(version)?.prerelease.length ?? 0) > 0,
    title: `${NAME} ${version}`,
    notes,
    tarballs: [NAME],
  },
];
writeFileSync(out, `${JSON.stringify(plan, null, 2)}\n`);
for (const { tag, prerelease } of plan) process.stdout.write(`${tag}${prerelease ? " (prerelease)" : ""}\n`);
