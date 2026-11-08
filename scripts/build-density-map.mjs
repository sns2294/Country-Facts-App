#!/usr/bin/env node
// Builds the population density world map (maps/population-density/index.html): a static choropleth of people per km²,
// drawn from the repo's own data, no live calls.
//
//   node scripts/build-density-map.mjs
//
// Inputs:
//   data/population-density.json   World Bank EN.POP.DNST (2023) plus three values computed from national statistics (scripts/update-density.mjs)
//   data/countries-10m.json        Natural Earth borders via world-atlas (public domain); data/countries.json for names and codes
//   map-data/lakes.json, map-data/disputed.json   lakes drawn in the sea color; the unsettled Kashmir and Kuril areas drawn neutral and hatched
// The color scale is 8 bins (not linear: density runs from under 1 to over 18,000), a multi-hue ramp from pale yellow to deep purple
// with a separate gray for "no data". The palettes below were checked against the real ocean colors and under deuteranopia and protanopia
// simulation; they are written into maps/maps.css (between the "density" markers), which the hub thumbnails and preview cards also use.
// Small countries and territories (too small to see at this scale) get a circle colored by density. The map pages are drawn by
// scripts/build-maps.mjs for the regional maps; this one shares its page pieces (scripts/map-page.mjs) and geometry helpers (scripts/geo-util.mjs).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { socialTags } from "./social-tags.mjs";
import { clipHalf, stitch } from "./geo-util.mjs";
import { THEME_SNIPPET, TOGGLE_SNIPPET, VIEWER_SNIPPET, FAVICON } from "./map-page.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const topojson = require(path.join(ROOT, "vendor/topojson-client.min.js"));
const SITE_CONFIG = JSON.parse(read("site.config.json"));
const INDEXABLE = SITE_CONFIG.indexable === true;
const BASE_URL = SITE_CONFIG.baseUrl.replace(/\/+$/, "");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = (n) => (Math.round(n * 10) / 10).toString();
const ID = "population-density";

// ---------- the scale ----------

const BINS = [ // upper limits (people per km²) and legend text
  { max: 10, label: "Under 10" }, { max: 25, label: "10–25" }, { max: 50, label: "25–50" }, { max: 100, label: "50–100" },
  { max: 200, label: "100–200" }, { max: 500, label: "200–500" }, { max: 1000, label: "500–1,000" }, { max: Infinity, label: "1,000 or more" },
];
const binOf = (d) => BINS.findIndex((b) => d < b.max);
const PALETTE = {
  light: { bins: ["#ffed75", "#ffd08d", "#ffa674", "#fe7262", "#f7066f", "#ba007b", "#77117e", "#2f1761"], nodata: "#adadad", ocean: "#cfe6f2" },
  dark: { bins: ["#fff7d0", "#fed397", "#feab7b", "#fe7c6c", "#ff3c7d", "#de028e", "#a80c93", "#46297e"], nodata: "#404040", ocean: "#0f2233" },
};
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// Each name takes whichever of the maps' two label colors reads better on its bin.
const inkFor = (theme, fill) => (ratio("#1d1f24", fill) >= ratio("#ffffff", fill) ? "#1d1f24" : "#ffffff");

function densityCss() {
  const vars = (t, extra) => PALETTE[t].bins.map((c, i) => `--d${i}: ${c};`).join(" ") + ` --nodata: ${PALETTE[t].nodata}; ${extra}`;
  const lbl = (t) => [...PALETTE[t].bins, PALETTE[t].nodata].map((fill, i) => {
    const ink = inkFor(t, fill), halo = ink === "#ffffff" ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.5)";
    return `.map-svg .lbl.k${i === 8 ? "nd" : i} { fill: ${ink}; stroke: ${halo}; }`;
  });
  return `/* density:start (written by scripts/build-density-map.mjs: the population density map's palette) */
.maps-page { ${vars("light", "--mk-ring: #ffffff; --legend-bg: rgba(255, 255, 255, 0.95); --legend-line: rgba(30, 50, 70, 0.28);")} }
:root.dark .maps-page { ${vars("dark", "--mk-ring: #ffffff; --legend-bg: rgba(11, 18, 25, 0.95); --legend-line: rgba(255, 255, 255, 0.28);")} }
${BINS.map((_, i) => `.map-svg .d${i} { fill: var(--d${i}); }`).join(" ")} .map-svg .dnd { fill: var(--nodata); }
/* the ring keeps its width on screen (1.5px) whatever the map's size or zoom, so the small circles stay outlined on a phone and in the full-screen viewer */
.map-svg .mk { stroke: var(--mk-ring); stroke-width: 1.5px; vector-effect: non-scaling-stroke; paint-order: stroke; }
.map-svg .mk-leader { stroke: var(--leader); stroke-width: 0.7; }
.map-svg .lbl.dens { font-weight: 700; letter-spacing: 0.01em; stroke-width: 2.2px; }
${lbl("light").join("\n")}
:root.dark ${lbl("dark").map((l) => l.replace(".map-svg", ".maps-page .map-svg")).join("\n:root.dark ")}
.map-svg .legend-box { fill: var(--legend-bg); stroke: var(--legend-line); stroke-width: 1; }
.map-svg .legend-title { font-size: 12.5px; font-weight: 700; fill: var(--label); }
.map-svg .legend-text { font-size: 11.5px; fill: var(--label); }
.map-svg .legend-sw { stroke: var(--legend-line); stroke-width: 0.8; }
.maps-page .map-caption { margin: 0.9rem 0 0; color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; }
/* The instruction line: touch wording on touch screens, pointer wording elsewhere. */
.maps-page .map-hint .hint-tap { display: none; }
@media (hover: none) and (pointer: coarse) {
  .maps-page .map-hint .hint-tap { display: inline; }
  .maps-page .map-hint .hint-click { display: none; }
}
.maps-page .map-viewer-help.is-reading { color: var(--text); font-weight: 600; }
/* density:end */`;
}
{ // keep maps/maps.css in step with the palette above
  const css = read("maps/maps.css"), block = densityCss();
  const re = /\/\* density:start[\s\S]*?\/\* density:end \*\//;
  const next = re.test(css) ? css.replace(re, () => block) : css.replace(/\n*$/, "\n\n") + block + "\n";
  if (next !== css) fs.writeFileSync(path.join(ROOT, "maps/maps.css"), next);
}

// ---------- data ----------

const countries = JSON.parse(read("data/countries.json"));
const density = JSON.parse(read("data/population-density.json"));
const capitals = JSON.parse(read("map-data/capitals.json"));
const numericToA3 = new Map(countries.filter((c) => c.numericCode).map((c) => [c.numericCode, c.alpha3Code]));
const info = new Map(countries.map((c) => [c.alpha3Code, c]));
// Natural Earth draws these pieces separately. Following the site's rules (shape-rules.js), a piece of a state that a breakaway or occupier
// holds is drawn as part of that state (Crimea, Northern Cyprus, Somaliland, the Golan); the Guantanamo base is Cuban territory;
// Kosovo and Western Sahara have their own value. Overseas territories without a World Bank value keep their own gray shape.
const NAME_OWNER = {
  Crimea: "UKR", "N. Cyprus": "CYP", "Cyprus U.N. Buffer Zone": "CYP", Akrotiri: "CYP", Dhekelia: "CYP", Kosovo: "UNK", Somaliland: "SOM",
  "Golan Heights": "SYR", Baikonur: "KAZ", "Siachen Glacier": "IND", "Coral Sea Is.": "AUS", "USNB Guantanamo Bay": "CUB",
  "Réunion": "REU", Mayotte: "MYT", "French Guiana": "GUF", Guadeloupe: "GLP", Martinique: "MTQ", "Svalbard and Jan Mayen": "SJM", "Bonaire, Sint Eustatius and Saba": "BES",
};
const SHORT = { COD: "DR Congo", COG: "Republic of the Congo", CIV: "Ivory Coast", MKD: "North Macedonia", BIH: "Bosnia and Herzegovina", SWZ: "Eswatini", PSE: "Palestine", FLK: "Falkland Islands" };
const nameOf = (a3) => SHORT[a3] || info.get(a3).name;
const fmtDensity = (d) => (d < 10 ? d.toFixed(1) : Math.round(d).toLocaleString("en-US"));

// ---------- shapes ----------

const topology = JSON.parse(read("data/countries-10m.json"));
const geomsByOwner = new Map();
for (const g of topology.objects.countries.geometries) {
  let a3 = g.id ? numericToA3.get(String(g.id).padStart(3, "0")) : null;
  if (g.properties.name in NAME_OWNER) a3 = NAME_OWNER[g.properties.name];
  if (!a3 || !info.has(a3)) continue;
  if (!geomsByOwner.has(a3)) geomsByOwner.set(a3, []);
  geomsByOwner.get(a3).push(g);
}
const DISSOLVE = new Set(["SOM", "SYR", "KAZ", "UKR", "CYP"]); // pieces drawn as one shape, so no seam shows
const raw = new Map(); // alpha3 -> [polygon], polygon = [ring, ring...] in degrees
for (const [a3, geoms] of geomsByOwner) {
  const merged = geoms.length > 1 && DISSOLVE.has(a3)
    ? topojson.merge(topology, geoms)
    : topojson.feature(topology, { type: "GeometryCollection", geometries: geoms }).features.reduce((m, f) => ({ type: "MultiPolygon", coordinates: [...m.coordinates, ...(f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates)] }), { type: "MultiPolygon", coordinates: [] });
  raw.set(a3, merged.type === "Polygon" ? [merged.coordinates] : merged.coordinates);
}
// Western Sahara: Natural Earth's Morocco includes the Moroccan-administered south; the recognized boundary is the 27°40'N parallel.
{
  const ringArea = (r) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0) / 2;
  const rest = [], moved = [];
  for (const poly of raw.get("MAR")) {
    const open = poly[0].slice(0, -1);
    const south = clipHalf(open, 1, 27 + 40 / 60, false);
    if (south.length >= 3) moved.push(south);
    const north = clipHalf(open, 1, 27 + 40 / 60, true);
    if (north.length >= 3 && Math.abs(ringArea(north)) > 1e-4) rest.push([[...north, north[0]], ...poly.slice(1)]);
  }
  raw.set("MAR", rest);
  const target = raw.get("ESH").map((poly) => ({ ring: poly[0].slice(0, -1), holes: poly.slice(1) }));
  const leftovers = [];
  for (const b of moved) {
    let done = false;
    for (const e of target) { const st = stitch(e.ring, b); if (st) { e.ring = st; done = true; break; } }
    if (!done) leftovers.push([[...b, b[0]]]);
  }
  raw.set("ESH", [...target.map((e) => [[...e.ring, e.ring[0]], ...e.holes]), ...leftovers]);
  console.log(`Western Sahara: ${moved.length} piece(s) of Morocco moved; ${leftovers.length} not stitched`);
}

// ---------- projection: Equal Earth (equal-area, so the sizes of the shaded areas are honest) ----------

const WIDTH = 1400;
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, SQ3 = Math.sqrt(3);
const D2R = Math.PI / 180;
function equalEarth(lon, lat) {
  const th = Math.asin((SQ3 / 2) * Math.sin(lat * D2R)), t2 = th * th, t6 = t2 * t2 * t2;
  return [(2 * SQ3 * lon * D2R * Math.cos(th)) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1)), th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
}
const XMAX = equalEarth(180, 0)[0], YMAX = equalEarth(0, 90)[1];
const SCALE = WIDTH / (2 * XMAX), HEIGHT = Math.round(2 * YMAX * SCALE);
const project = (lon, lat) => { const [x, y] = equalEarth(lon, lat); return [WIDTH / 2 + x * SCALE, HEIGHT / 2 - y * SCALE]; };

const signedArea = (r) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0) / 2;
const MIN_RING = 0.25; // square SVG units; smaller islands are specks (tiny countries get a circle instead)
function projectRing(ring) {
  let r = ring.slice(0, ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? -1 : undefined);
  const dense = [];
  for (let i = 0; i < r.length; i++) { // straight lines in longitude and latitude bend on this map: add points along the long ones
    const a = r[i], b = r[(i + 1) % r.length], n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 1));
    for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const pts = dense.map(([lo, la]) => project(lo, la)), out = [];
  for (const p of pts) if (!out.length || Math.hypot(p[0] - out.at(-1)[0], p[1] - out.at(-1)[1]) >= 0.35) out.push(p); // drop points closer than a third of a pixel
  return out.length >= 3 && Math.abs(signedArea(out)) >= MIN_RING ? out : null;
}
// A few Natural Earth rings (Chukotka, Fiji) cross the 180° meridian as one ring, with a jump from one side of the map to the other.
// Unwrap the longitudes and cut such a ring at ±180 into one piece per side. (A ring that goes round the pole, Antarctica, is left alone.)
function splitAtDateline(ring) {
  const open = ring.slice(0, ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? -1 : undefined);
  const n = open.length;
  if (!open.some((p, i) => Math.abs(open[(i + 1) % n][0] - p[0]) > 180)) return [open];
  let shift = 0;
  const unwrapped = open.map((p, i) => {
    if (i) { const d = p[0] - open[i - 1][0]; if (d > 180) shift -= 360; else if (d < -180) shift += 360; }
    return [p[0] + shift, p[1]];
  });
  const closing = open[0][0] - open[n - 1][0];
  const net = shift + (closing > 180 ? -360 : closing < -180 ? 360 : 0);
  if (net !== 0) return [open]; // goes round the pole
  const pieces = [];
  for (const k of [-360, 0, 360]) {
    let r = unwrapped.map(([x, y]) => [x + k, y]);
    r = clipHalf(clipHalf(r, 0, -180, true), 0, 180, false);
    if (r.length >= 3) pieces.push(r);
  }
  return pieces;
}
const projectPolys = (polys) => polys.flatMap((poly) => splitAtDateline(poly[0]).flatMap((piece, k) => {
  const outer = projectRing(piece);
  if (!outer) return [];
  return [{ rings: [outer, ...(k === 0 ? poly.slice(1).map(projectRing).filter(Boolean) : [])] }];
}));
const areaOf = (polys) => polys.reduce((s, p) => s + Math.abs(signedArea(p.rings[0])), 0);
const pathOf = (polys) => polys.map((p) => p.rings.map((r) => "M" + r.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L") + "Z").join("")).join("");

const shapes = new Map();
for (const [a3, polys] of raw) { const sp = projectPolys(polys); if (sp.length) shapes.set(a3, sp); }

// ---------- lakes and unsettled areas ----------

const lakes = JSON.parse(read("map-data/lakes.json")).map((lk) => ({ polys: projectPolys(lk.p) })).filter((l) => l.polys.length && areaOf(l.polys) >= 10);
const disputed = JSON.parse(read("map-data/disputed.json")).filter((a) => a.group === "kashmir" || a.group === "kurils");
const disputedPolys = projectPolys(disputed.flatMap((a) => a.p));

// ---------- the value of each place ----------

const valueOf = (a3) => density.values[a3];
const colorClass = (a3) => { const v = valueOf(a3); return v ? `d${binOf(v.density)}` : "dnd"; };
const tipOf = (a3) => {
  const v = valueOf(a3);
  if (!v) return `${nameOf(a3)}: no data`;
  return `${nameOf(a3)}: ${fmtDensity(v.density)} people per km²${v.source === "national" ? ` (national statistics, ${v.year})` : ""}`;
};

// ---------- small countries and territories: a circle colored by density ----------

const MARK_R = 3.5, MARK_BELOW = 30; // a place whose shape covers fewer than this many square units gets a circle
const markers = [];
for (const [a3, v] of Object.entries(density.values)) {
  const polys = raw.get(a3);
  if (!polys) continue;
  if (shapes.has(a3) && areaOf(shapes.get(a3)) >= MARK_BELOW) continue;
  const big = polys.reduce((m, p) => (Math.abs(signedArea(p[0])) > Math.abs(signedArea(m[0])) ? p : m), polys[0])[0];
  const xs = big.map((q) => q[0]), ys = big.map((q) => q[1]);
  const [x, y] = project((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
  markers.push({ a3, x, y, ax: x, ay: y });
}
for (let it = 0; it < 200; it++) { // push overlapping circles apart (a small leader line then joins each to its true place)
  let moved = false;
  for (let i = 0; i < markers.length; i++) for (let j = i + 1; j < markers.length; j++) {
    const a = markers[i], b = markers[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, min = MARK_R * 2 + 1.6;
    if (d < min) { const k = (min - d) / 2 / d; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; moved = true; }
  }
  if (!moved) break;
}

// ---------- country names ----------

const inPoly = (x, y, rings) => { let inside = false; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
const edgeDist = (x, y, rings) => { let m = Infinity; for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [x1, y1] = r[j], [x2, y2] = r[i], dx = x2 - x1, dy = y2 - y1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1))); m = Math.min(m, Math.hypot(x - x1 - t * dx, y - y1 - t * dy)); } return m; };
const widest = (px) => px * 0.56; // average width of a bold letter, per unit of font size
const labels = [];
const taken = []; // boxes already used
const boxHit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const LEG = { x: WIDTH - 18 - 150, w: 150, rowH: 17, pad: 10, bottom: 12 }; // the legend sits in the empty Southern Ocean south of New Zealand, clear of Antarctica
const legendRows = [...BINS.map((b, i) => ({ cls: `d${i}`, text: b.label })), { cls: "dnd", text: "No data" }];
const legH = 30 + legendRows.length * LEG.rowH + LEG.pad - 4, legY = HEIGHT - LEG.bottom - legH;
taken.push([LEG.x - 4, legY - 4, LEG.x + LEG.w + 4, legY + legH + 4]);
for (const m of markers) taken.push([m.x - 6, m.y - 6, m.x + 6, m.y + 6]);
for (const [a3, polys] of [...shapes].sort((a, b) => areaOf(b[1]) - areaOf(a[1]))) {
  if (a3 === "ATA" || areaOf(polys) < 150) continue;
  const poly = polys.reduce((m, p) => (Math.abs(signedArea(p.rings[0])) > Math.abs(signedArea(m.rings[0])) ? p : m), polys[0]);
  const xs = poly.rings[0].map((q) => q[0]), ys = poly.rings[0].map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const name = nameOf(a3), words = name.split(" ");
  const variants = [[name]]; if (words.length > 1) { const h = Math.ceil(words.length / 2); variants.push([words.slice(0, h).join(" "), words.slice(h).join(" ")]); }
  let best = null;
  for (let y = y0 + 2; y <= y1 - 2; y += 3) for (let x = x0 + 2; x <= x1 - 2; x += 3) {
    if (!inPoly(x, y, poly.rings)) continue;
    const d = edgeDist(x, y, poly.rings);
    if (d < 3.5) continue;
    for (const lines of variants) for (let size = 11.5; size >= 7; size -= 0.5) {
      const mult = lines.length === 1 ? 1.15 : 1;
      if (best && size * mult + 0.4 < best.score) break; // cannot beat what we have (the roomier spot wins ties: +d/20)
      const w = Math.max(...lines.map((l) => l.length)) * widest(size) + 2, h = size * 1.1 * lines.length;
      if (d < Math.min(w, h * 1.6) / 2 * 0.62) continue;
      const box = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      if (box[0] < 4 || box[2] > WIDTH - 4 || taken.some((t) => boxHit(t, box))) continue;
      let ok = true; // the whole text box must lie on this country
      for (let yy = box[1]; yy <= box[3] && ok; yy += 3) for (let xx = box[0]; xx <= box[2]; xx += 3) if (!inPoly(xx, yy, poly.rings)) { ok = false; break; }
      if (!ok) continue;
      const score = size * mult + Math.min(d, 40) / 20;
      if (!best || score > best.score) best = { a3, lines, size, x, y, box, score };
      break;
    }
  }
  if (best && best.size >= 7) { labels.push(best); taken.push(best.box.map((v, i) => v + (i < 2 ? -1 : 1))); }
}

// ---------- markup ----------

const land = [...shapes].sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0])))
  .map(([a3, polys]) => `<path class="c ${colorClass(a3)}" data-code="${a3}" fill-rule="evenodd" d="${pathOf(polys)}"><title>${esc(tipOf(a3))}</title></path>`).join("\n      ");
const lakeMarkup = `<g class="lakes">${lakes.map((l) => `<path class="lake" d="${pathOf(l.polys)}" />`).join("")}</g>`;
const disputedMarkup = `<g class="disputed">
        <path class="disp" d="${pathOf(disputedPolys)}"><title>Disputed area (Kashmir and the Southern Kuril Islands): not given to any country</title></path>
        <path class="disp-hatch" d="${pathOf(disputedPolys)}" />
      </g>`;
const labelMarkup = labels.map((l) => {
  const cls = `lbl dens k${valueOf(l.a3) ? binOf(valueOf(l.a3).density) : "nd"}`;
  const lh = l.size * 1.1, y0 = l.y - (lh * (l.lines.length - 1)) / 2;
  return `<text class="${cls}" font-size="${f1(l.size)}">${l.lines.map((t, i) => `<tspan x="${f1(l.x)}" y="${f1(y0 + i * lh + l.size * 0.35)}">${esc(t)}</tspan>`).join("")}</text>`;
}).join("\n      ");
const markerMarkup = markers.map((m) => {
  const far = Math.hypot(m.x - m.ax, m.y - m.ay) > 2.5;
  return `${far ? `<line class="mk-leader" x1="${f1(m.ax)}" y1="${f1(m.ay)}" x2="${f1(m.x)}" y2="${f1(m.y)}" />\n      ` : ""}<circle class="mk ${colorClass(m.a3)}" data-code="${m.a3}" cx="${f1(m.x)}" cy="${f1(m.y)}" r="${MARK_R}"><title>${esc(tipOf(m.a3))}</title></circle>`;
}).join("\n      ");
// The legend is inside the SVG so the full-screen viewer, the hub thumbnails and the preview cards all show it.
const legendMarkup = `<g class="legend" transform="translate(${LEG.x} ${legY})">
        <rect class="legend-box" width="${LEG.w}" height="${legH}" rx="7" />
        <text class="legend-title" x="${LEG.pad}" y="19">People per km²</text>
        ${legendRows.map((r, i) => `<rect class="legend-sw ${r.cls}" x="${LEG.pad}" y="${28 + i * LEG.rowH}" width="22" height="12" rx="2" /><text class="legend-text" x="${LEG.pad + 30}" y="${28 + i * LEG.rowH + 10}">${esc(r.text)}</text>`).join("\n        ")}
      </g>`;

const markerCount = markers.length;
const svg = `<svg class="map-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="map-title map-desc" xmlns="http://www.w3.org/2000/svg">
    <title id="map-title">Population density of the world</title>
    <desc id="map-desc">A world map shading each country by its population density in people per square kilometer, in eight steps from under 10 to 1,000 or more, with gray for places without data. Small countries and territories are marked with circles. Source: World Bank, 2023 data.</desc>
    <defs>
      <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="hatch-line" x1="0" y1="0" x2="0" y2="5" /></pattern>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="1.5" dy="3" stdDeviation="3" class="shadow-flood" /></filter>
      <clipPath id="frame"><rect width="${WIDTH}" height="${HEIGHT}" rx="14" /></clipPath>
    </defs>
    <g clip-path="url(#frame)">
      <rect class="ocean" width="${WIDTH}" height="${HEIGHT}" />
      <g class="land" filter="url(#shadow)">
      ${land}
      </g>
      ${disputedMarkup}
      ${lakeMarkup}
      <g class="labels">
      ${labelMarkup}
      </g>
      <g class="markers">
      ${markerMarkup}
      </g>
      ${legendMarkup}
    </g>
  </svg>`;

// ---------- page ----------

// In the full-screen viewer a tap (or click) on a country, or on one of the small circles, shows its density in the bar above the map
// (touch screens have no hover). A drag does not count as a tap.
const READOUT_SNIPPET = `(function(){var stage=document.getElementById("map-stage"),help=document.querySelector(".map-viewer-help");if(!stage||!help)return;
var idle=help.textContent,down=null;
stage.addEventListener("pointerdown",function(e){down=[e.clientX,e.clientY]});
stage.addEventListener("click",function(e){if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;
var el=document.elementFromPoint(e.clientX,e.clientY),p=el&&el.closest("[data-code]"),t=p&&p.querySelector("title");
if(t){help.textContent=t.textContent;help.classList.add("is-reading")}else{help.textContent=idle;help.classList.remove("is-reading")}});
})();`;

const TITLE = "Population Density Map of the World (People per km²) | Country Facts";
const DESCRIPTION = "A world map of population density: how many people live per square kilometer in every country, from Mongolia to Bangladesh to Monaco. World Bank data, 2023.";
const CAPTION = "Source: World Bank (EN.POP.DNST), 2023 data. People per km² of land area. Taiwan, Kosovo and Vatican City from national statistics (2023–2024 figures).";
const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(TITLE)}</title>
  <meta name="description" content="${esc(DESCRIPTION)}" />
  <link rel="canonical" href="${BASE_URL}/maps/${ID}/" />
${INDEXABLE ? "" : `  <meta name="robots" content="noindex" />\n`}  <meta property="og:url" content="${BASE_URL}/maps/${ID}/" />
  ${socialTags({ baseUrl: BASE_URL, siteName: "Country Facts", title: TITLE, description: DESCRIPTION, image: `og/map-${ID}.png` })}
  <link rel="icon" href="${FAVICON}" />
  <link rel="icon" type="image/png" sizes="192x192" href="../../favicon-192.png" />
  <script>${THEME_SNIPPET}</script>
  <link rel="stylesheet" href="../../style.css" />
  <link rel="stylesheet" href="../../country-page.css" />
  <link rel="stylesheet" href="../maps.css" />
</head>
<body>
  <header class="app-header">
    <div class="app-header-text">
      <a class="site-title" href="../../">Country Facts</a>
      <p class="app-subtitle">Explore countries, browse the map, and test what you know.</p>
    </div>
    <button id="dark-mode-toggle" type="button" aria-pressed="false" title="Toggle dark mode">
      <span id="dark-mode-icon" aria-hidden="true">🌙</span>
    </button>
  </header>
  <main class="country-page maps-page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="../../">Country Facts</a> <span aria-hidden="true">›</span> <a href="../">Maps</a> <span aria-hidden="true">›</span> <span>Population density</span></nav>
    <section class="page-card map-card">
      <a class="map-back" href="../">← All maps</a>
      <h1>Population density of the world</h1>
      <p class="map-lede">How crowded each country is, in people per square kilometer. The steps are uneven on purpose: density runs from under 1 in Greenland to over 18,000 in Monaco, so each step is roughly two to three times the one before.</p>
      <p class="map-hint"><span class="hint-tap">Tap the map to open it full screen, then pinch to zoom and drag to move. Tap a country for its density.</span><span class="hint-click">Click the map to open it full screen, then scroll to zoom and drag to move. Hover a country for its density.</span></p>
      <button type="button" class="map-open" id="map-open" style="--ratio:${(WIDTH / HEIGHT).toFixed(4)}" aria-label="Open the map full size">
  ${svg}
      </button>
      <p class="map-caption">${esc(CAPTION)}</p>
      <p class="map-note">Gray means no data, as for Antarctica, Western Sahara and most small territories. Hatching marks areas whose ownership is unsettled (Kashmir, the Southern Kuril Islands). Circles mark small countries and territories that are too small to see at this scale; they are shaded by their density and pushed apart where crowded. Borders: <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a> (public domain), drawn in the Equal Earth projection, which keeps areas true to size.</p>
    </section>
  <div class="map-viewer" id="map-viewer" role="dialog" aria-modal="true" aria-label="Population density map, full size" hidden>
    <div class="map-viewer-bar">
      <span class="map-viewer-help">Pinch or scroll to zoom, drag to move</span>
      <span class="map-viewer-buttons">
        <button type="button" id="map-zoom-out" aria-label="Zoom out">&minus;</button>
        <button type="button" id="map-zoom-in" aria-label="Zoom in">+</button>
        <button type="button" id="map-zoom-reset" aria-label="Reset zoom">Reset</button>
        <button type="button" id="map-close" aria-label="Close the full-size map">&times;</button>
      </span>
    </div>
    <div class="map-viewer-stage" id="map-stage"></div>
  </div>
  </main>
  <footer class="site-footer">
    <p class="data-credits">
      Data:
      <a href="https://data.worldbank.org/indicator/EN.POP.DNST" target="_blank" rel="noopener">World Bank</a>,
      <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a>.
    </p>
    <p class="footer-feedback"><a href="mailto:hello@countryfacts.app">Send feedback</a></p>
  </footer>
  <script>${VIEWER_SNIPPET}</script>
  <script>${READOUT_SNIPPET}</script>
  <script>${TOGGLE_SNIPPET}</script>
</body>
</html>
`;
fs.mkdirSync(path.join(ROOT, "maps", ID), { recursive: true });
fs.writeFileSync(path.join(ROOT, "maps", ID, "index.html"), page);
const counts = BINS.map(() => 0); let nd = 0;
for (const a3 of shapes.keys()) { const v = valueOf(a3); if (v) counts[binOf(v.density)]++; else nd++; }
console.log(`maps/${ID}/index.html written (${WIDTH}x${HEIGHT}, ${(page.length / 1024).toFixed(0)} KB); ${shapes.size} shapes, ${markerCount} circles, ${labels.length} names, ${lakes.length} lakes`);
console.log("shapes per bin:", counts.join(" "), "no data:", nd);
