#!/usr/bin/env node
// Checks that the disputed areas are neutral in the data every surface reads (data/countries-*.json, world-map.svg):
// no point inside an area that has no settled owner belongs to a country, and no country keeps more than a sliver of the
// Kashmir area. Read-only; run it after any change to the shapes or a data refresh. Exits 1 on a failure.
//
//   node scripts/check-disputed.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { DISPUTED_CUTS } from "./split-territories.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const topojson = require(path.join(ROOT, "vendor/topojson-client.min.js"));
const pc = require(path.join(ROOT, "vendor/polygon-clipping.umd.min.js"));
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// [name, lon, lat, neutral shape that must hold it, or null where an atlas does not draw it]
const POINTS = [
  ["Srinagar (Indian-administered Kashmir)", 74.8, 34.08, "Kashmir"],
  ["Muzaffarabad (Azad Kashmir)", 73.47, 34.37, "Kashmir"],
  ["Gilgit", 74.3, 35.92, "Kashmir"],
  ["Aksai Chin", 79.5, 35.0, "Kashmir"],
  ["Siachen Glacier", 77.1, 35.4, "Kashmir"],
  ["Shaksgam Valley", 76.3, 36.2, "Kashmir"],
  ["Iturup (Southern Kurils)", 147.5, 45.0, "Southern Kuril Islands"],
  ["Shikotan (Southern Kurils)", 146.75, 43.8, "Southern Kuril Islands"],
  // only the 10m atlas draws these
  ["Woody Island (Paracels)", 112.33, 16.835, "Paracel Islands", "10m"],
];
// the countries whose shapes must never hold a disputed point
const OWNERS = ["India", "Pakistan", "China", "Russia", "Japan", "South Korea"];

const inRing = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inPoly = (p, rings) => inRing(p, rings[0]) && !rings.slice(1).some((h) => inRing(p, h));
const area = (ring) => Math.abs(ring.reduce((a, q, i) => { const n = ring[(i + 1) % ring.length]; return a + (q[0] * n[1] - n[0] * q[1]); }, 0) / 2);

let failures = 0;
const fail = (msg) => { failures += 1; console.error("FAIL: " + msg); };

// every atlas: name -> polygons in degrees
function shapesOfAtlas(file) {
  const t = JSON.parse(read(file));
  const out = new Map();
  for (const g of t.objects.countries.geometries) {
    const f = topojson.feature(t, g).geometry;
    if (f) out.set(g.properties.name, f.type === "Polygon" ? [f.coordinates] : f.coordinates);
  }
  return out;
}
// the flat map: name -> polygons (x = longitude, y = -latitude)
function shapesOfSvg() {
  const out = new Map();
  for (const m of read("world-map.svg").matchAll(/<path [^>]*data-name="([^"]*)"[^>]*d="([^"]*)"/g)) {
    const polys = m[2].match(/M[^M]*/g).map((r) => [r.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g).map((q) => { const [x, y] = q.split(",").map(Number); return [x, -y]; })]);
    out.set(m[1], [...(out.get(m[1]) || []), ...polys]);
  }
  return out;
}

const sources = [
  ["data/countries-50m.json", shapesOfAtlas("data/countries-50m.json"), "50m"],
  ["data/countries-50m-full.json", shapesOfAtlas("data/countries-50m-full.json"), "50m"],
  ["data/countries-10m.json", shapesOfAtlas("data/countries-10m.json"), "10m"],
  ["world-map.svg", shapesOfSvg(), "50m"],
];
const kashmir = DISPUTED_CUTS.find((c) => c.name === "Kashmir");
const U = pc.union(...JSON.parse(read("map-data/disputed.json")).filter((a) => a.group === kashmir.group).flatMap((a) => a.p).map((p) => [p]));

for (const [file, shapes, scale] of sources) {
  const holders = (lon, lat) => [...shapes].filter(([, polys]) => polys.some((p) => inPoly([lon, lat], p))).map(([n]) => n);
  for (const [name, lon, lat, want, only] of POINTS) {
    if (only && only !== scale) continue;
    const who = holders(lon, lat);
    if (!who.includes(want)) fail(`${file}: ${name} is not in the neutral shape "${want}" (held by: ${who.join(", ") || "nothing"})`);
    for (const o of OWNERS) if (who.includes(o)) fail(`${file}: ${name} is still inside ${o}`);
  }
  for (const o of OWNERS) {
    const polys = shapes.get(o) || [];
    const overlap = polys.length ? pc.intersection(U, pc.union(...polys.map((p) => [p]))).reduce((a, p) => a + area(p[0]), 0) : 0;
    if (overlap > 0.02) fail(`${file}: ${o} still covers ${overlap.toFixed(3)} square degrees of the Kashmir area`);
  }
  const k = shapes.get("Kashmir");
  const kArea = (k || []).reduce((a, p) => a + area(p[0]), 0);
  if (!k || kArea < 20) fail(`${file}: the Kashmir shape is missing or too small (${kArea.toFixed(2)} square degrees)`);
}
console.log(`disputed areas checked in ${sources.length} files: ${failures ? failures + " failure(s)" : "OK"}`);
process.exit(failures ? 1 : 0);
