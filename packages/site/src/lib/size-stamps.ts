/**
 * This module holds the pure part of the sizes on the guide. It reads the output of `size-limit` and makes the data
 * stamps of the pages with a size. It imports nothing, so the script of the Pages workflow can start it with Node.js.
 */

/** The sizes that one build measured, in bytes after minification and gzip, by the name in `.size-limit.json`. */
export interface SizeFile {
  readonly sizes: Readonly<Record<string, number>>;
}

/** One run in a data stamp. */
export interface StampRun {
  readonly id: string;
  readonly url: string;
  readonly date: string;
  readonly engines: Readonly<Record<string, string>>;
}

/** Why a fixed study has no age limit (site-pages 0.3.0): no run of the current code gives its numbers, and its page claims nothing about today. */
export interface NoLimit {
  readonly reproduce: string;
  readonly today: string;
}

/** One entry of the file `data-stamps.json`. */
export interface PageStamp {
  readonly page: string;
  readonly runs: readonly StampRun[];
  readonly study?: true;
  readonly noLimit?: NoLimit;
}

const COMMITS = "https://github.com/mark1russell7/ireko/commit";

/** The pages that show a size from the build. */
export const PAGES_WITH_A_SIZE: readonly string[] = [
  "compare/index.html",
  "guides/react-flow/index.html",
  "learn/quick-start/index.html",
  "learn/renderers/index.html",
  "reference/api/index.html",
];

/** The fixed studies of the guide. Each page says in its text that its numbers are a study of that version. */
export const STUDIES: readonly PageStamp[] = [
  {
    page: "compare/index.html",
    study: true,
    runs: [{ id: "a823ef0", url: `${COMMITS}/a823ef0c3b22959ed1cc8430aeda0b0f0a0559d8`, date: "2026-10-13", engines: { "@dagrejs/dagre": "3.1.1", elkjs: "0.12.0", "d3-hierarchy": "3.1.2" } }],
    noLimit: {
      reproduce:
        "The sizes are of the exact versions @dagrejs/dagre 3.1.1, elkjs 0.12.0 and d3-hierarchy 3.1.2. The build of the current code measures only ireko, not these engines.",
      today: "The page says that these sizes are a fixed study from October 2026 of those versions. It claims nothing about newer releases of the three engines.",
    },
  },
  {
    page: "design/two-passes/index.html",
    study: true,
    runs: [{ id: "c1f2eba", url: `${COMMITS}/c1f2ebaa7f202529fdaca4e9b9072bab46fb9a6c`, date: "2026-10-13", engines: { ireko: "0.1.0" } }],
    noLimit: {
      reproduce: "The times are of ireko 0.1.0 at commit c1f2eba. A run of the current code measures a newer release, not 0.1.0.",
      today: "The page says that the table is a fixed study of ireko 0.1.0 on one machine, and that only the ratio is to be compared.",
    },
  },
  {
    page: "reference/api/index.html",
    study: true,
    runs: [{ id: "1d575a6", url: `${COMMITS}/1d575a642cee164bfe65687680afe19b40ed4d13`, date: "2026-11-04", engines: { ireko: "0.1.4" } }],
    noLimit: {
      reproduce:
        "The ratios are of ireko 0.1.4 at commit 1d575a6, from run 41804066495 of the branch entry-time. The paired measure with an A/A arm is not on main, so no run of the current code gives this table.",
      today: "The page says that the table is a fixed study of ireko 0.1.4, and that it tells nothing about a newer release.",
    },
  },
];

/** This function reads the output of `size-limit --json`. Output with no size is an error, so the build stops. */
export function parseSizes(output: string): SizeFile {
  const rows = JSON.parse(output.slice(output.indexOf("["))) as readonly { name: string; size: number }[];
  if (rows.length === 0) throw new Error("size-limit gave no size.");
  const sizes: Record<string, number> = {};
  for (const { name, size } of rows) {
    if (!Number.isFinite(size) || size <= 0) throw new Error(`size-limit gave no size for ${name}.`);
    sizes[name] = size;
  }
  return { sizes };
}

/** This function gives the data stamps of the site: the run of this build for each size, and the fixed studies. */
export function sizeStamps(run: StampRun): { readonly schema: "data-stamp/1"; readonly pages: readonly PageStamp[] } {
  return { schema: "data-stamp/1", pages: [...PAGES_WITH_A_SIZE.map((page) => ({ page, runs: [run] })), ...STUDIES] };
}
