/** The facts of the site. The base path comes from Astro, so a new name of the repository needs no change here. */
export const NAME = "ireko";
export const ORIGIN = "https://mark1russell7.github.io";
/** The absolute URL of the home page, with a slash at the end. */
export const SITE: string = `${ORIGIN}${import.meta.env.BASE_URL.replace(/\/?$/, "/")}`;
export const REPOSITORY = "https://github.com/mark1russell7/ireko";
export const NPM = "https://www.npmjs.com/package/ireko";
export const AUTHOR = { name: "Mark Russell", url: "https://github.com/mark1russell7" } as const;
export const TAGLINE = "Composable graph and tree layout for TypeScript. Select a layout for each container, and get boxes and routed edges for any renderer.";

/** This function gives the path of a page of the site, with the base path. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}
