/** The sizes that the pages show. The Pages workflow measures them before the build, so no size is typed in a page. */
import type { SizeFile } from "./size-stamps.ts";

const files = import.meta.glob<{ default: SizeFile }>("../data/size.json", { eager: true });
const measured = files["../data/size.json"]?.default;

/** The text of a build with no measure, for example a build on a computer. */
export const NOT_MEASURED = "not measured in this build";

/**
 * This function gives the text of a size, by its name in `.size-limit.json`. A name that the file does not have is an
 * error, so a renamed budget stops the build and no page shows a wrong size.
 */
export function sizeText(name: string, file: SizeFile | undefined = measured): string {
  if (file === undefined) return NOT_MEASURED;
  const bytes = file.sizes[name];
  if (bytes === undefined) throw new Error(`The measured sizes have no size "${name}".`);
  return `${(bytes / 1000).toFixed(1)} kB`;
}
