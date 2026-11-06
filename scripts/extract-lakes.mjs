#!/usr/bin/env node
// Extracts the major lakes for the labelled maps (scripts/build-maps.mjs) from Natural Earth's 10m lakes file.
//
//   node scripts/extract-lakes.mjs path/to/ne_10m_lakes.geojson     writes map-data/lakes.json
//
// Source: https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-lakes/ (public domain; the GeoJSON copy is
// in https://github.com/nvkelso/natural-earth-vector). The main lakes file draws today's lakes: the shrunken Aral Sea
// (North and South basins) and Lake Chad at its present size; the separate "historic lakes" file, with the old outlines,
// is not used. Only lakes of scale rank 5 or bigger are kept (the Great Lakes, the African Rift lakes, Baikal, the Aral
// Sea and Issyk-Kul among them), simplified to about a kilometre. The Caspian Sea is left out: it is already water in
// the country shapes.
//
// Output: [{ n: name, r: scale rank (0 = biggest), p: [polygon, ...] }], a polygon being [outer ring, ...island rings]
// of [lon, lat] points. map-data/ holds this because update-data.mjs replaces data/ wholesale.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const input = process.argv[2];
if (!input) { console.error("usage: node scripts/extract-lakes.mjs path/to/ne_10m_lakes.geojson"); process.exit(1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_RANK = 5, TOLERANCE = 0.008, MIN_ISLAND_AREA = 0.0004; // degrees, square degrees

const round = (n) => Math.round(n * 1000) / 1000;
function simplify(points, tol) { // Douglas-Peucker on an open polyline
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = points[a], [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((by - ay) * points[i][0] - (bx - ax) * points[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
const area = (r) => { let s = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); };

const data = JSON.parse(fs.readFileSync(input, "utf8"));
const out = [];
for (const f of data.features) {
  const { scalerank: r, name } = f.properties;
  if (r > MAX_RANK || name === "Caspian Sea") continue;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const kept = [];
  for (const poly of polys) {
    const rings = [];
    poly.forEach((ring, i) => {
      const open = ring.slice(0, -1);
      let s = simplify(open, TOLERANCE).map(([x, y]) => [round(x), round(y)]);
      if (s.length < 3 || (i > 0 && area(s) < MIN_ISLAND_AREA)) return;
      rings.push(s);
    });
    if (rings.length) kept.push(rings);
  }
  if (kept.length) out.push({ n: name || "", r, p: kept });
}
out.sort((a, b) => a.r - b.r || a.n.localeCompare(b.n));
fs.writeFileSync(path.join(ROOT, "map-data/lakes.json"), JSON.stringify(out));
console.log(`map-data/lakes.json: ${out.length} lakes, ${out.reduce((s, l) => s + l.p.reduce((t, p) => t + p.reduce((u, r) => u + r.length, 0), 0), 0)} points`);
