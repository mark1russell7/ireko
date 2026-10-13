import type { LayoutSnapshot } from "../../layout/types";

export function snapshotToSVG(s: LayoutSnapshot): string {
  const minX = s.stats.bounds.position.x;
  const minY = s.stats.bounds.position.y;
  const w = s.stats.bounds.size.x;
  const h = s.stats.bounds.size.y;

  const lines = s.wires
    .map((w) => {
      if (w.polyline && w.polyline.length >= 2) {
        const points = w.polyline.map(p => `${p.x},${p.y}`).join(" ");
        return `<polyline points="${points}" fill="none" stroke="#94a3b8" stroke-width="1" />`;
      }
      const a = s.boxes[w.source]; const b = s.boxes[w.target];
      if (!a || !b) return "";
      const ac = a.position.add(a.size.halve());
      const bc = b.position.add(b.size.halve());
      return `<line x1="${ac.x}" y1="${ac.y}" x2="${bc.x}" y2="${bc.y}" stroke="#94a3b8" stroke-width="1" />`;
    })
    .join("");

  const rects = Object.values(s.boxes)
    .sort((A, B) => A.depth - B.depth || A.id.localeCompare(B.id))
    .map(
      (b) =>
        `<rect x="${b.position.x}" y="${b.position.y}" width="${b.size.x}" height="${b.size.y}" rx="10" ry="10" fill="#fff" stroke="#cbd5e1" />`
    )
    .join("");

  const labels = Object.values(s.boxes)
    .map((b) => {
      const cx = b.position.x + b.size.x / 2;
      const cy = b.position.y + b.size.y / 2;
      return `<text x="${cx}" y="${cy}" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#0f172a">${b.id}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX} ${minY} ${w} ${h}">
    <rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#ffffff"/>
    ${lines}
    ${rects}
    ${labels}
  </svg>`;
}
