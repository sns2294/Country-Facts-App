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
// Every country and territory is drawn at its true size, however small (Monaco is a speck at world view and grows as the viewer zooms in,
// to 450 screen px per map unit). Small places also get an invisible tap area (picked by distance in the page's script, with the same rules
// as the flat map in app.js), and a "Most crowded places" box under the map zooms the viewer to the ten densest. The map pages are drawn by
// scripts/build-maps.mjs for the regional maps; this one shares its page pieces (scripts/map-page.mjs) and geometry helpers (scripts/geo-util.mjs).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { socialTags } from "./social-tags.mjs";
import { clipHalf, stitch } from "./geo-util.mjs";
import { THEME_SNIPPET, TOGGLE_SNIPPET, viewerSnippet, FAVICON } from "./map-page.mjs";

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
/* Borders are 1 map unit on the page; the viewer sets --sw from the zoom so they stay under a pixel wide at any zoom (it goes to 450px per map unit).
   Places under a few pixels across have no border, so their color shows. */
.map-svg .c, .map-svg .lake, .map-svg .disp { stroke-width: var(--sw, 1); }
.map-svg .c.t { stroke: none; }
/* The ring around the place just picked: two rings (dark inside, light outside) so it shows on any color; the viewer sets their widths from the zoom. */
.map-svg .focus-ring { fill: none; pointer-events: none; }
.map-svg .focus-ring.in { stroke: #1d1f24; }
.map-svg .focus-ring.out { stroke: #ffffff; stroke-opacity: 0.9; }
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
/* "Most crowded places": the ten densest, under the map. One column on a phone, two from 640px. */
.maps-page .crowded { margin: 1rem 0 0; padding: 0.85rem 0.9rem 0.95rem; border: 1px solid rgba(128, 128, 128, 0.3); border-radius: 12px; background: var(--bg); }
.maps-page .crowded h2 { margin: 0; font-size: 1.05rem; font-weight: 600; }
.maps-page .crowded-sub { margin: 0.2rem 0 0.65rem; color: var(--text-muted); font-size: 0.85rem; line-height: 1.4; }
.maps-page .crowded-sub .hint-tap { display: none; }
@media (hover: none) and (pointer: coarse) {
  .maps-page .crowded-sub .hint-tap { display: inline; }
  .maps-page .crowded-sub .hint-click { display: none; }
}
.maps-page .crowded-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: 0.25rem 0.6rem; }
@media (min-width: 640px) { .maps-page .crowded-list { grid-template-columns: 1fr 1fr; grid-auto-flow: row; } }
.maps-page .crowded-row { display: flex; align-items: baseline; gap: 0.45rem; width: 100%; min-height: 2.2rem; padding: 0.3rem 0.65rem; border: 1px solid rgba(128, 128, 128, 0.3); border-radius: 0.6rem; background: var(--surface); color: var(--text); font: inherit; font-size: 0.9rem; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.maps-page .crowded-row:hover { border-color: var(--accent); }
.maps-page .crowded-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.maps-page .crowded-row .rk { flex: none; width: 1.3rem; color: var(--text-muted); font-size: 0.8rem; font-variant-numeric: tabular-nums; }
.maps-page .crowded-row .nm { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.maps-page .crowded-row .dot { color: var(--text-muted); }
.maps-page .crowded-row .val { color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.maps-page .crowded-row .val b { color: var(--text); font-weight: 600; }
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

// Vatican City's polygon in Natural Earth is a 4-point line with no area. It is drawn as a disc of its real area (0.44 km², radius 374 m)
// around its real position (41.9029°N, 12.4534°E), so it is a true-size place like the others.
{
  const lat0 = 41.9029, lon0 = 12.4534, r = 0.374 / 111.2, ring = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * 2 * Math.PI; ring.push([lon0 + (r * Math.cos(a)) / Math.cos(lat0 * Math.PI / 180), lat0 + r * Math.sin(a)]); }
  ring.push(ring[0]);
  raw.set("VAT", [[ring]]);
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

// Borders between countries are drawn separately for each country, and thinning each one's points differently leaves slivers of sea between
// neighbors. Near the places in the "Most crowded places" box (which the viewer zooms in on) every point is kept, so shared borders match exactly.
const NEAR_R = 8;
const NEAR = Object.entries(density.values).sort((a, b) => b[1].density - a[1].density).slice(0, 12).flatMap(([a3]) => (raw.get(a3) || []).map((poly) => {
  const xs = poly[0].map((q) => q[0]), ys = poly[0].map((q) => q[1]);
  return project((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
}));
const isNear = (p) => NEAR.some((c) => Math.hypot(p[0] - c[0], p[1] - c[1]) < NEAR_R);

const signedArea = (r) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0) / 2;
const MIN_RING = 0.25; // square SVG units; smaller islands are specks (tiny countries get a circle instead)
// `fine` (small places) keeps every point and every ring, however small: Monaco is a few hundredths of a map unit across.
function projectRing(ring, fine = false) {
  let r = ring.slice(0, ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? -1 : undefined);
  const dense = [];
  for (let i = 0; i < r.length; i++) { // straight lines in longitude and latitude bend on this map: add points along the long ones
    const a = r[i], b = r[(i + 1) % r.length], n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 1));
    for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const pts = dense.map(([lo, la]) => project(lo, la)), out = [];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const step = fine && Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 3 ? 0 : 0.35; // a small place's specks keep every point
  for (const p of pts) if (!out.length || Math.hypot(p[0] - out.at(-1)[0], p[1] - out.at(-1)[1]) >= step || isNear(p)) out.push(p); // drop points closer than a third of a pixel
  return out.length >= 3 && Math.abs(signedArea(out)) >= (fine ? 1e-7 : MIN_RING) ? out : null;
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
const projectPolys = (polys, fine = false) => polys.flatMap((poly) => splitAtDateline(poly[0]).flatMap((piece, k) => {
  const outer = projectRing(piece, fine);
  if (!outer) return [];
  return [{ rings: [outer, ...(k === 0 ? poly.slice(1).map((r) => projectRing(r, fine)).filter(Boolean) : [])] }];
}));
const areaOf = (polys) => polys.reduce((s, p) => s + Math.abs(signedArea(p.rings[0])), 0);
const f3 = (n) => (Math.round(n * 1000) / 1000).toString();
const f2 = (n) => (Math.round(n * 100) / 100).toString();
// `fine` (small places): a ring under 1 map unit across gets 3 decimals, under 10 gets 2, so a speck keeps its shape without the big islands growing the page.
const pathOf = (polys, fine = false) => polys.map((p) => p.rings.map((r) => {
  let f = f1;
  if (fine) { const xs = r.map((q) => q[0]), ys = r.map((q) => q[1]), size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); f = size < 1 ? f3 : size < 10 ? f2 : f1; }
  return "M" + r.map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z";
}).join("")).join("");

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

// ---------- small countries and territories: drawn at true size, picked by distance ----------

// A place whose shapes cover under this many square units in all (Cyprus is 15, Monaco 0.003) is redrawn with every point and ring kept,
// gets no border, and is picked by the page's script from an invisible area around it instead of by hitting its few pixels.
const SMALL_PLACE = 40;
const smallPlaces = new Set();
for (const [a3, polys] of raw) {
  if (a3 === "ATA") continue;
  if (shapes.has(a3) && areaOf(shapes.get(a3)) >= SMALL_PLACE) continue;
  const fine = projectPolys(polys, true);
  if (fine.length) { shapes.set(a3, fine); smallPlaces.add(a3); }
}
const boxOf = (polys) => { // [x0, y0, x1, y1] of a set of shapes
  const pts = polys.flatMap((p) => p.rings[0]);
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};
const focusOf = (a3) => { // [centre x, centre y, size, readout text, 1 if a small place]; a place split by the dateline (Kiribati, Fiji) is judged by its largest piece
  let polys = shapes.get(a3), box = boxOf(polys);
  if (Math.max(box[2] - box[0], box[3] - box[1]) > 100) { polys = [polys.reduce((m, p) => (Math.abs(signedArea(p.rings[0])) > Math.abs(signedArea(m.rings[0])) ? p : m), polys[0])]; box = boxOf(polys); }
  return [+f3((box[0] + box[2]) / 2), +f3((box[1] + box[3]) / 2), +f3(Math.max(box[2] - box[0], box[3] - box[1])), tipOf(a3), smallPlaces.has(a3) ? 1 : 0];
};
const decimate = (ring, max = 24) => { const step = Math.ceil(ring.length / max); return ring.filter((_, i) => i % step === 0); }; // corners are enough to measure a distance to
const pickAreas = []; // [code, size of this shape (map units), corners x,y,x,y...]
const focus = {};
for (const a3 of smallPlaces) {
  focus[a3] = focusOf(a3);
  for (const p of shapes.get(a3)) {
    const [x0, y0, x1, y1] = boxOf([p]);
    const size = Math.max(x1 - x0, y1 - y0), corners = size < 0.06 ? [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] : decimate(p.rings[0]); // a speck is measured by its bounding box
    pickAreas.push([a3, +f3(size), corners.flatMap(([x, y]) => [+f3(x), +f3(y)])]);
  }
}
// The ten densest places (the "Most crowded places" box).
const crowded = Object.entries(density.values).filter(([a3]) => shapes.has(a3)).sort((a, b) => b[1].density - a[1].density).slice(0, 10).map(([a3]) => a3);
for (const a3 of crowded) if (!focus[a3]) focus[a3] = focusOf(a3);

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

// Small places are drawn last, so a big neighbor's border never covers them. Under 4 square units (2 px across) a place has no border.
const land = [...shapes].sort((a, b) => (smallPlaces.has(a[0]) - smallPlaces.has(b[0])) || nameOf(a[0]).localeCompare(nameOf(b[0])))
  .map(([a3, polys]) => `<path class="c ${colorClass(a3)}${smallPlaces.has(a3) && areaOf(polys) < 4 ? " t" : ""}" data-code="${a3}" fill-rule="evenodd" d="${pathOf(polys, smallPlaces.has(a3))}"><title>${esc(tipOf(a3))}</title></path>`).join("\n      ");
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
// The legend is inside the SVG so the full-screen viewer, the hub thumbnails and the preview cards all show it.
const legendMarkup = `<g class="legend" transform="translate(${LEG.x} ${legY})">
        <rect class="legend-box" width="${LEG.w}" height="${legH}" rx="7" />
        <text class="legend-title" x="${LEG.pad}" y="19">People per km²</text>
        ${legendRows.map((r, i) => `<rect class="legend-sw ${r.cls}" x="${LEG.pad}" y="${28 + i * LEG.rowH}" width="22" height="12" rx="2" /><text class="legend-text" x="${LEG.pad + 30}" y="${28 + i * LEG.rowH + 10}">${esc(r.text)}</text>`).join("\n        ")}
      </g>`;

const svg = `<svg class="map-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="map-title map-desc" xmlns="http://www.w3.org/2000/svg">
    <title id="map-title">Population density of the world</title>
    <desc id="map-desc">A world map shading each country by its population density in people per square kilometer, in eight steps from under 10 to 1,000 or more, with gray for places without data. Small countries and territories are drawn at their true size and appear as you zoom in. Source: World Bank, 2023 data.</desc>
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
      ${legendMarkup}
    </g>
  </svg>`;

// ---------- page ----------

// In the full-screen viewer a tap (or click) on a country shows its density in the bar above the map (touch screens have no hover);
// a drag does not count as a tap. Small places have no big shape to hit, so they are picked by distance, with the flat map's rules
// (app.js, nearestTiny): over open sea or an empty lake, the nearest small place within 22px of its shape; over another country's land
// only one within 1px of its shape (0.5px if that country is itself under 8px across); on a small place's own shape, that place.
// The "Most crowded places" rows open the viewer, zoom to the place, ring it and show its density.
// A row zooms in to ROW_ZOOM screen px per map unit (the viewer's own limit is 450): far enough that a small place is a clear shape, not so far that the
// coarse coast beside it shows. A place under 12px across at that zoom (Monaco, Gibraltar, Vatican City) goes closer, to 12px or the limit.
const ROW_ZOOM = 50;
const READOUT_SNIPPET = `(function(){var V=window.mapViewer,stage=document.getElementById("map-stage"),help=document.querySelector(".map-viewer-help");if(!V||!stage||!help)return;
var D=${JSON.stringify({ pick: pickAreas, focus })},PICK=D.pick,FOCUS=D.focus,REACH=22,OVER_LAND=1,OVER_TINY=0.5,TINY_LAND=8,MAXPX=70,ROWK=${ROW_ZOOM};
var idle=help.textContent,down=null,current=null,ringIn=null,ringOut=null,hatch=document.getElementById("hatch"),queued=false,forced=false;
function say(t){if(t){help.textContent=t;help.classList.add("is-reading")}else{help.textContent=idle;help.classList.remove("is-reading")}}
function seg(px,py,ax,ay,bx,by){var dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l)):0;return Math.hypot(px-ax-t*dx,py-ay-t*dy)}
function landAt(x,y){var el=document.elementFromPoint(x,y);return el&&el.closest?el.closest("path.c[data-code]"):null}
function nearest(x,y,land){var svg=V.svg(),m=svg&&svg.getScreenCTM();if(!m||!m.a)return null;
 var own=land&&land.dataset.code,reach=REACH;
 if(land){var r=land.getBoundingClientRect();reach=Math.max(r.width,r.height)<TINY_LAND?OVER_TINY:OVER_LAND}
 var best=null,bd=Infinity;
 for(var i=0;i<PICK.length;i++){var a=PICK[i],d=Infinity;
  if(a[1]*m.a>=MAXPX)continue;
  if(a[0]===own)d=0;else{var v=a[2],n=v.length/2,px=m.a*v[0]+m.e,py=m.d*v[1]+m.f,fx=px,fy=py;
   for(var j=1;j<=n;j++){var qx=j<n?m.a*v[2*j]+m.e:fx,qy=j<n?m.d*v[2*j+1]+m.f:fy;d=Math.min(d,seg(x,y,px,py,qx,qy));px=qx;py=qy}}
  if(d<=reach&&d<bd){best=a[0];bd=d}}
 return best}
function ring(){if(!ringIn)return;var f=current&&FOCUS[current];
 if(f){var k=V.px(),span=f[2]*k,wide=f[2]>8,sz=Math.min(stage.clientWidth,stage.clientHeight);
  if(span<2*sz&&(forced||span<(f[4]?100:32)||(wide&&f[4]))){var r=wide?f[2]/2*1.08:Math.max(22/k,f[2]/2*1.15);
   ringIn.style.strokeWidth=(2/k)+"px";ringOut.style.strokeWidth=(4.5/k)+"px";
   [ringIn,ringOut].forEach(function(c){c.setAttribute("cx",f[0]);c.setAttribute("cy",f[1]);c.setAttribute("r",r);c.style.display=""});return}}
 ringIn.style.display=ringOut.style.display="none"}
// At high zoom the page-sized extras get in the way: the shadow under the land, the names (they would be hundreds of px tall), and the hatching (which would be a few huge stripes).
function tune(){var s=V.svg();if(!s)return;var k=V.px(),f=k>1.2?k:1,d=5/f;s.style.setProperty("--sw",String(0.8/k));
 s.querySelector(".land").style.filter=k>8?"none":"";s.querySelector(".labels").style.display=k>6?"none":"";
 if(hatch){hatch.setAttribute("width",d);hatch.setAttribute("height",d);var l=hatch.firstElementChild;l.setAttribute("y2",d);l.style.strokeWidth=(1.1/f)+"px"}
 ring()}
V.onshow=function(s){current=null;forced=false;var g=s.querySelector(".labels").parentNode;
 ringOut=document.createElementNS("http://www.w3.org/2000/svg","circle");ringOut.setAttribute("class","focus-ring out");
 ringIn=ringOut.cloneNode();ringIn.setAttribute("class","focus-ring in");ringIn.style.display=ringOut.style.display="none";g.appendChild(ringOut);g.appendChild(ringIn)};
V.onchange=tune;
V.onhide=function(){current=null;ringIn=ringOut=null;say(null);if(hatch){hatch.setAttribute("width",5);hatch.setAttribute("height",5);var l=hatch.firstElementChild;l.setAttribute("y2",5);l.style.strokeWidth=""}};
function tipOf(land){var t=land&&land.querySelector("title");return t?t.textContent:null}
stage.addEventListener("pointerdown",function(e){down=[e.clientX,e.clientY]});
stage.addEventListener("click",function(e){if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;
 var land=landAt(e.clientX,e.clientY),code=nearest(e.clientX,e.clientY,land)||(land&&land.dataset.code);
 forced=false;current=code;ring();
 if(code&&FOCUS[code])say(FOCUS[code][3]);else say(tipOf(land))});
stage.addEventListener("mousemove",function(e){if(e.buttons||queued)return;queued=true;var x=e.clientX,y=e.clientY;
 requestAnimationFrame(function(){queued=false;var land=landAt(x,y),code=nearest(x,y,land);
  stage.title=code&&(!land||land.dataset.code!==code)&&FOCUS[code]?FOCUS[code][3]:""})});
Array.prototype.forEach.call(document.querySelectorAll(".crowded-row"),function(row){row.addEventListener("click",function(){
 var code=row.getAttribute("data-code"),f=FOCUS[code];if(!f)return;
 V.open();forced=true;current=code;var sz=Math.min(stage.clientWidth,stage.clientHeight);
 V.focus(f[0],f[1],f[2]>8?0.85*sz/f[2]:Math.min(0.45*sz/f[2],Math.max(ROWK,12/f[2])));say(f[3]);ring()})});
})();`;

const crowdedMarkup = crowded.map((a3, i) => {
  const d = fmtDensity(valueOf(a3).density);
  return `<li><button type="button" class="crowded-row" data-code="${a3}" aria-label="${esc(nameOf(a3))}: ${d} people per km². Zoom the map to it."><span class="rk">${i + 1}</span><span class="nm">${esc(nameOf(a3))}</span><span class="dot" aria-hidden="true">·</span><span class="val"><b>${d}</b> per km²</span></button></li>`;
}).join("\n          ");
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
      <p class="map-lede">How crowded each country is, in people per square kilometer. The steps are uneven on purpose: density runs from under 1 in Greenland to over 20,000 in Macao, so each step is roughly two to three times the one before.</p>
      <p class="map-hint"><span class="hint-tap">Tap the map to open it full screen, then pinch to zoom and drag to move. Tap a country for its density.</span><span class="hint-click">Click the map to open it full screen, then scroll to zoom and drag to move. Hover a country for its density.</span></p>
      <button type="button" class="map-open" id="map-open" style="--ratio:${(WIDTH / HEIGHT).toFixed(4)}" aria-label="Open the map full size">
  ${svg}
      </button>
      <aside class="crowded" aria-labelledby="crowded-title">
        <h2 id="crowded-title">Most crowded places</h2>
        <p class="crowded-sub">People per km². <span class="hint-tap">Tap</span><span class="hint-click">Click</span> a place to zoom the map to it.</p>
        <ol class="crowded-list">
          ${crowdedMarkup}
        </ol>
      </aside>
      <p class="map-caption">${esc(CAPTION)}</p>
      <p class="map-note">Gray means no data, as for Antarctica, Western Sahara and most small territories. Hatching marks areas whose ownership is unsettled (Kashmir, the Southern Kuril Islands). Small countries and territories are drawn at their true size, so places like Monaco and the Maldives are specks at this scale and show as you zoom in; the list above jumps to the most crowded. Borders: <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a> (public domain), drawn in the Equal Earth projection, which keeps areas true to size.</p>
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
  <script>${viewerSnippet({ maxPxPerUnit: 450 })}</script>
  <script>${READOUT_SNIPPET}</script>
  <script>${TOGGLE_SNIPPET}</script>
</body>
</html>
`;
fs.mkdirSync(path.join(ROOT, "maps", ID), { recursive: true });
fs.writeFileSync(path.join(ROOT, "maps", ID, "index.html"), page);
const counts = BINS.map(() => 0); let nd = 0;
for (const a3 of shapes.keys()) { const v = valueOf(a3); if (v) counts[binOf(v.density)]++; else nd++; }
console.log(`maps/${ID}/index.html written (${WIDTH}x${HEIGHT}, ${(page.length / 1024).toFixed(0)} KB); ${shapes.size} shapes, ${labels.length} names, ${lakes.length} lakes`);
console.log("shapes per bin:", counts.join(" "), "no data:", nd);
