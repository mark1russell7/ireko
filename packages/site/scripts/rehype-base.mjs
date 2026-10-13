/**
 * A rehype plugin: it adds the base path of the site to each link and image of the content that starts with "/".
 * The pages write "/learn/tour/", and the built page has "/ireko/learn/tour/", or the base of the repository.
 */
export default function rehypeBase(base) {
  const prefix = base.replace(/\/$/, "");
  const fix = (value) => (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith(`${prefix}/`) ? `${prefix}${value}` : value);
  const visit = (node) => {
    if (node.type === "element" && node.properties !== undefined) {
      if ("href" in node.properties) node.properties.href = fix(node.properties.href);
      if ("src" in node.properties) node.properties.src = fix(node.properties.src);
    }
    for (const child of node.children ?? []) visit(child);
  };
  return () => visit;
}
