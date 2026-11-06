#!/usr/bin/env node
// Builds the "More maps" pages: static, labelled maps drawn from the repo's own data.
//
//   node scripts/build-maps.mjs            writes every region below
//   node scripts/build-maps.mjs africa     writes one region (maps/africa/index.html)
//
// Inputs (all free, no live calls):
//   data/countries-10m.json   Natural Earth borders via world-atlas (public domain)
//   data/countries.json       names and alpha codes (see README for its sources)
//   map-data/capitals.json    capital coordinates, Natural Earth "populated places" (public domain)
// The map is an inline SVG so it follows the site's dark-mode toggle (an <img> SVG could not).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const topojson = require(path.join(ROOT, "vendor/topojson-client.min.js"));
const T = require(path.join(ROOT, "country-text.js"));
const DARK_MODE_KEY = "countryFacts.darkMode".replace("countryFacts.", "countryFactsApp.");

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n) => (Math.round(n * 10) / 10).toString();

// ---------- which shapes belong to which country ----------

const countries = JSON.parse(read("data/countries.json"));
const capitals = JSON.parse(read("map-data/capitals.json"));
const numericToA3 = new Map(countries.filter((c) => c.numericCode).map((c) => [c.numericCode, c.alpha3Code]));
const a3Info = new Map(countries.map((c) => [c.alpha3Code, c]));

// Small dependencies are drawn in their parent's colour and carry no label of their own.
const PARENT = { ALA: "FIN", FRO: "DNK", GIB: "ESP", GGY: "GBR", JEY: "GBR", IMN: "GBR" };
// Natural Earth draws these pieces separately (Crimea is split out of Russia by scripts/split-territories.mjs).
// Following the site's rules (shape-rules.js): a piece of a UN member state that a breakaway or occupier holds
// is drawn as part of that state (Crimea, Northern Cyprus, Somaliland); Kosovo and Western Sahara have their own cards.
const NAME_OWNER = { Crimea: "UKR", "N. Cyprus": "CYP", "Cyprus U.N. Buffer Zone": "CYP", Akrotiri: "CYP", Dhekelia: "CYP", Kosovo: "UNK", Somaliland: "SOM", "Réunion": "REU", Mayotte: "MYT" };
const DISPLAY = { UNK: "Kosovo", VAT: "Vatican City", MKD: "North Macedonia", CZE: "Czechia", BIH: "Bosnia and Herzegovina", GBR: "United Kingdom", COD: "DR Congo", COG: "Republic of the Congo", CIV: "Ivory Coast", STP: "São Tomé and Príncipe", CPV: "Cape Verde", SWZ: "Eswatini" };
const nameOf = (a3) => DISPLAY[a3] || T.getBorderDisplayName(a3Info.get(a3).name);
const CONTEXT_LABEL_MAX = 15;

// ---------- the regions ----------
// members: the coloured countries. context: grey neighbours that get a muted label where they fit.
// share: a territory drawn in another country's colour. links: extra "touching" pairs (narrow seas) for the colouring.
// micro: tiny countries labelled outside with a pointer line, in the order they are placed (side: which way the label goes).
const REGIONS = {
  europe: {
    name: "Europe",
    members: countries.filter((c) => c.region === "Europe" && (c.sovereign || c.alpha3Code === "UNK") && c.alpha3Code !== "SJM").map((c) => c.alpha3Code),
    extraColoured: ["GRL"], share: { GRL: "DNK" },
    context: ["TUR", "MAR", "DZA", "TUN", "LBY", "EGY", "SYR", "KAZ", "GEO", "ARM", "AZE", "IRQ", "LBN", "ISR", "JOR"],
    lon0: 10, lat0: 52, frame: { west: -25.5, east: 43, south: 34.2, north: 71.6 },
    links: [["UNK", "SRB"], ["UNK", "ALB"], ["UNK", "MKD"], ["UNK", "MNE"], // Kosovo has no border list
      ["DNK", "SWE"], ["DNK", "NOR"], ["GBR", "FRA"], ["EST", "FIN"], ["ITA", "MLT"], ["ITA", "HRV"], ["GRC", "ITA"],
      ["GBR", "NOR"], ["LVA", "SWE"], ["POL", "SWE"], ["DEU", "SWE"], ["CYP", "GRC"], ["ISL", "GBR"], ["ISL", "NOR"], ["DNK", "ISL"], ["ESP", "ITA"], ["FRA", "ITA"]],
    micro: ["SMR", "MCO", "AND", "VAT", "LUX", "LIE", "MLT"], // the only countries that get pointer lines
    microFixed: { LIE: [710, 654] }, // Liechtenstein: a short line north into southern Germany (by Lake Constance), not the far-off Mediterranean
    microSide: { SMR: "east", VAT: "west" }, // San Marino's label goes in the Adriatic (east of it); the Vatican's in the Tyrrhenian Sea
    seas: [
      { t: "Atlantic Ocean", lon: -17, lat: 45, rot: -62, size: 17, sp: 0.35 },
      { t: "Norwegian Sea", lon: -2, lat: 66.8, rot: -14, size: 13, sp: 0.22 },
      { t: "North Sea", lon: 3.2, lat: 56.3, rot: -62, size: 13, sp: 0.22 },
      { t: "Baltic Sea", lon: 19.8, lat: 57.9, rot: 62, size: 12, sp: 0.2 },
      { t: "Bay of Biscay", lon: -5.2, lat: 45, rot: 0, size: 10, sp: 0.15 },
      { t: "Celtic Sea", lon: -8.8, lat: 50.2, rot: 0, size: 9.5, sp: 0.15 },
      { t: "Mediterranean Sea", lon: 3.2, lat: 37.1, rot: 4, size: 15, sp: 0.3 },
      { t: "Tyrrhenian Sea", lon: 11.2, lat: 40.3, rot: -48, size: 9.5, sp: 0.14 },
      { t: "Adriatic Sea", lon: 15.5, lat: 42.4, rot: 40, size: 8.5, sp: 0.08 },
      { t: "Ionian Sea", lon: 18.6, lat: 38.1, rot: 0, size: 10, sp: 0.2 },
      { t: "Aegean Sea", lon: 25.1, lat: 38.9, rot: 0, size: 9.5, sp: 0.12 },
      { t: "Black Sea", lon: 34.3, lat: 43.4, rot: 0, size: 14, sp: 0.3 },
      { t: "Barents Sea", lon: 36.5, lat: 71.2, rot: 0, size: 12, sp: 0.22 },
      { t: "Caspian Sea", lon: 51, lat: 43, rot: 0, size: 11, sp: 0.2 },
    ],
    lede: "Dots mark capital cities; the smallest states are labeled with a pointer line.",
    noteExtra: "Drawn in the ETRS89 Lambert azimuthal equal-area projection. Shapes are simplified; Kosovo is shown as the site's own entry.",
    projectionName: "ETRS89 Lambert azimuthal equal-area",
  },
  africa: {
    name: "Africa",
    preciseLabelBoxes: true,
    // The 54 African countries plus Western Sahara, which has its own card on the site.
    members: countries.filter((c) => c.region === "Africa" && (c.sovereign || c.alpha3Code === "ESH")).map((c) => c.alpha3Code),
    extraColoured: [], share: {},
    context: ["ESP", "PRT", "FRA", "ITA", "GRC", "TUR", "CYP", "SYR", "LBN", "ISR", "PSE", "JOR", "IRQ", "SAU", "YEM", "OMN", "IRN"],
    width: 1650, lon0: 20, lat0: 2, frame: { west: -26.5, east: 64, south: -36, north: 38.5 },
    links: [["COM", "MOZ"], ["COM", "TZA"], ["COM", "MDG"], ["MDG", "MOZ"], ["MUS", "MDG"], ["SYC", "TZA"], ["SYC", "KEN"], ["SYC", "SOM"],
      ["CPV", "SEN"], ["CPV", "MRT"], ["STP", "GAB"], ["STP", "GNQ"], ["GNQ", "CMR"], ["MUS", "SYC"], ["COM", "SYC"], ["ESH", "MAR"], ["ESH", "DZA"], ["ESH", "MRT"]],
    micro: ["CPV", "GMB", "GNB", "STP", "GNQ", "DJI", "SYC", "COM", "MUS"],
    microFixed: {}, microSide: {},
    seas: [
      { t: "Atlantic Ocean", lon: -14, lat: 8, rot: 0, size: 17, sp: 0.35 },
      { t: "Atlantic Ocean", lon: 0, lat: -26, rot: 0, size: 17, sp: 0.35 },
      { t: "Indian Ocean", lon: 59, lat: -22, rot: 0, size: 17, sp: 0.35 },
      { t: "Mediterranean Sea", lon: 17, lat: 35.2, rot: 0, size: 13, sp: 0.3 },
      { t: "Red Sea", lon: 37.6, lat: 20.5, rot: 52, size: 10.5, sp: 0.2 },
      { t: "Gulf of Guinea", lon: 4, lat: 2.6, rot: 0, size: 11, sp: 0.2 },
      { t: "Gulf of Aden", lon: 50, lat: 12.7, rot: -8, size: 9.5, sp: 0.14 },
      { t: "Arabian Sea", lon: 60, lat: 13, rot: 0, size: 11, sp: 0.2 },
      { t: "Mozambique Channel", lon: 41.5, lat: -19, rot: 62, size: 9.5, sp: 0.14 },
      { t: "Bay of Biscay", lon: -5.5, lat: 44.5, rot: 0, size: 8.5, sp: 0.1 },
    ],
    lede: "Western Sahara is shown as its own territory. Dots mark capital cities; the island nations are labeled with a pointer line.",
    noteExtra: "Drawn in the Lambert azimuthal equal-area projection. Borders are the internationally recognized ones: Somaliland is shown as part of Somalia, and Western Sahara, whose status the UN has not settled (Morocco administers most of it), is shown as its own territory, as on its country page.",
    projectionName: "Lambert azimuthal equal-area",
  },
};

const REGION_ID = process.argv[2];
if (!REGION_ID) {
  const { execFileSync } = await import("node:child_process");
  for (const id of Object.keys(REGIONS)) execFileSync(process.execPath, [fileURLToPath(import.meta.url), id], { stdio: "inherit" });
  process.exit(0);
}
const R = REGIONS[REGION_ID];
if (!R) throw new Error(`Unknown region "${REGION_ID}" (have: ${Object.keys(REGIONS).join(", ")})`);
const EUROPE = R.members; // (historic name) the countries coloured on this map
const COLOURED = [...R.members, ...(R.extraColoured || [])];
const CONTEXT = R.context;

const topology = JSON.parse(read("data/countries-10m.json"));
const rawByOwner = new Map(); // alpha3 -> [polygons], polygon = [ring, ring...]
const geomsByOwner = new Map();
const clipLat = (ring, keepSouth) => { // Sutherland-Hodgman against one parallel, in degrees
  const inside = (p) => (keepSouth ? p[1] <= WESTERN_SAHARA_NORTH : p[1] >= WESTERN_SAHARA_NORTH);
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) out.push([a[0] + ((WESTERN_SAHARA_NORTH - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), WESTERN_SAHARA_NORTH]);
  }
  return out;
};
for (const g of topology.objects.countries.geometries) {
  let a3 = g.id ? numericToA3.get(String(g.id).padStart(3, "0")) : NAME_OWNER[g.properties.name];
  if (g.properties.name in NAME_OWNER) a3 = NAME_OWNER[g.properties.name];
  if (!a3) continue;
  a3 = PARENT[a3] || a3;
  if (!geomsByOwner.has(a3)) geomsByOwner.set(a3, []);
  geomsByOwner.get(a3).push(g);
}
// Somalia + Somaliland are dissolved into one shape so no seam shows. (Europe's merged pieces, such as Cyprus, keep
// their seam: dissolving them shifted that approved map's labels.)
const DISSOLVE = new Set(["SOM"]);
// Natural Earth's Morocco includes the Moroccan-administered part of Western Sahara. The internationally recognized
// boundary is the 27°40'N parallel (the Tarfaya border), so on maps that show Western Sahara, the part of Morocco's
// shape south of it is moved to Western Sahara, making the territory one whole.
const WESTERN_SAHARA_NORTH = 27 + 40 / 60;
for (const [a3, geoms] of geomsByOwner) {
  const merged = geoms.length > 1 && DISSOLVE.has(a3) ? topojson.merge(topology, geoms) : topojson.feature(topology, { type: "GeometryCollection", geometries: geoms }).features.reduce((m, f) => ({ type: "MultiPolygon", coordinates: [...m.coordinates, ...(f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates)] }), { type: "MultiPolygon", coordinates: [] });
  rawByOwner.set(a3, merged.type === "Polygon" ? [merged.coordinates] : merged.coordinates);
}
if (R.members.includes("ESH")) {
  const north = [], south = [];
  for (const poly of rawByOwner.get("MAR")) {
    const open = poly[0].slice(0, -1);
    const n = clipLat(open, false), so = clipLat(open, true);
    if (n.length >= 3) north.push([[...n, n[0]], ...poly.slice(1)]);
    if (so.length >= 3) south.push([[...so, so[0]]]);
  }
  rawByOwner.set("MAR", north);
  // Stitch each southern piece to the Natural Earth Western Sahara outline along the vertices they share (the berm), so no seam shows.
  const key = (c) => `${c[0]},${c[1]}`;
  const stitch = (a, b) => { // a, b: open rings; returns one open ring, or null if they do not share exactly one contiguous run
    const inB = new Set(b.map(key)), inA = new Set(a.map(key));
    const shared = a.map((c) => inB.has(key(c)));
    const n = a.length, count = shared.filter(Boolean).length;
    if (!count || count === n) return null;
    let start = -1; // first shared vertex after a non-shared one
    for (let i = 0; i < n; i++) if (shared[i] && !shared[(i + n - 1) % n]) { if (start >= 0) return null; start = i; }
    if (start < 0) return null;
    const run = []; // a's shared run, in a's order
    for (let k = 0; k < count; k++) { if (!shared[(start + k) % n]) return null; run.push(a[(start + k) % n]); }
    const s0 = key(run[0]), s1 = key(run.at(-1));
    const aRest = []; // from just after the run, round to just before it
    for (let k = count; k < n; k++) aRest.push(a[(start + k) % n]);
    // b: walk from s0's... find s1 in b, then go on (away from the run) until s0
    const m = b.length, bi = (id) => b.findIndex((c) => key(c) === id);
    const i1 = bi(s1), i0 = bi(s0);
    for (const dir of [1, -1]) {
      const path = [];
      let i = i1, ok = true;
      for (let guard = 0; guard < m; guard++) {
        i = (i + dir + m) % m;
        if (i === i0) break;
        if (inA.has(key(b[i]))) { ok = false; break; }
        path.push(b[i]);
        if (guard === m - 1) ok = false;
      }
      if (ok && path.length) return [run.at(-1), ...aRest, run[0], ...path.reverse()]; // the shared run becomes interior
    }
    return null;
  };
  let esh = rawByOwner.get("ESH").map((poly) => ({ ring: poly[0].slice(0, -1), holes: poly.slice(1) }));
  const leftovers = [];
  for (const poly of south) {
    const b = poly[0].slice(0, -1);
    let done = false;
    for (const e of esh) { const st = stitch(e.ring, b); if (st) { e.ring = st; done = true; break; } }
    if (!done) leftovers.push(poly);
  }
  console.log(`Western Sahara: ${south.length} piece(s) of Morocco moved; ${leftovers.length} not stitched`);
  rawByOwner.set("ESH", [...esh.map((e) => [[...e.ring, e.ring[0]], ...e.holes]), ...leftovers]);
}
for (const a3 of EUROPE) if (!rawByOwner.has(a3)) throw new Error(`No shape for ${a3}`);

// ---------- projection (Lambert azimuthal equal-area, centred per region; Europe uses the EU's ETRS89 centre) ----------

const D2R = Math.PI / 180;
const LON0 = R.lon0 * D2R;
const LAT0 = R.lat0 * D2R;
function laea(lon, lat) {
  const l = lon * D2R, p = lat * D2R;
  const k = Math.sqrt(2 / (1 + Math.sin(LAT0) * Math.sin(p) + Math.cos(LAT0) * Math.cos(p) * Math.cos(l - LON0)));
  return [k * Math.cos(p) * Math.sin(l - LON0), k * (Math.cos(LAT0) * Math.sin(p) - Math.sin(LAT0) * Math.cos(p) * Math.cos(l - LON0))];
}
// Frame: the geographic window the map shows. Output units = SVG user units.
const FRAME = R.frame;
const WIDTH = R.width || 1400;
let SCALE, X0, Y0, HEIGHT;
{
  const pts = [];
  for (let i = 0; i <= 200; i++) {
    const lon = FRAME.west + ((FRAME.east - FRAME.west) * i) / 200;
    pts.push(laea(lon, FRAME.south), laea(lon, FRAME.north));
    const lat = FRAME.south + ((FRAME.north - FRAME.south) * i) / 200;
    pts.push(laea(FRAME.west, lat), laea(FRAME.east, lat));
  }
  // Fit the western/eastern/southern edges tightly; the fan-shaped north gets a little air.
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  SCALE = WIDTH / (maxX - minX);
  X0 = -minX; Y0 = maxY;
  HEIGHT = Math.round((maxY - minY) * SCALE);
}
const project = (lon, lat) => {
  const [x, y] = laea(lon, lat);
  return [(x + X0) * SCALE, (Y0 - y) * SCALE];
};

// ---------- clipping (Sutherland-Hodgman against a convex window) ----------

function clipRing(ring, inside, cross) {
  let out = ring;
  for (const edge of [0, 1, 2, 3]) {
    if (!out.length) break;
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i], b = input[(i + 1) % input.length];
      const ia = inside(a, edge), ib = inside(b, edge);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cross(a, b, edge));
    }
  }
  return out;
}
const boxClip = (x0, y0, x1, y1) => ({
  inside: (p, e) => (e === 0 ? p[0] >= x0 : e === 1 ? p[0] <= x1 : e === 2 ? p[1] >= y0 : p[1] <= y1),
  cross: (a, b, e) => {
    const v = e === 0 ? x0 : e === 1 ? x1 : e === 2 ? y0 : y1;
    if (e < 2) { const t = (v - a[0]) / (b[0] - a[0]); return [v, a[1] + t * (b[1] - a[1])]; }
    const t = (v - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), v];
  },
});
const viewWindow = boxClip(-30, -30, WIDTH + 30, HEIGHT + 30);

function ringArea(r) {
  let s = 0;
  for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}
// A ring that crosses the antimeridian jumps from +180 to -180; make longitudes continuous instead.
function unwrap(ring) {
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
}
// Great-circle-ish densify so long edges bend with the projection.
function densify(ring, step = 0.5) {
  ring = unwrap(ring);
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    out.push(a);
    const n = Math.floor(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / step);
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / (n + 1), a[1] + ((b[1] - a[1]) * k) / (n + 1)]);
  }
  return out;
}
// A country becomes a list of polygons in SVG units: [{ rings: [outer, ...holes] }].
function projectCountry(polys) {
  const result = [];
  for (const poly of polys) {
    const rings = [];
    poly.forEach((ring, idx) => {
      let r = ring.slice(0, ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? -1 : undefined);
      r = densify(r);
      if (r.length < 3) return;
      r = clipRing(r.map(([lo, la]) => project(lo, la)), viewWindow.inside, viewWindow.cross);
      if (r.length < 3 || Math.abs(ringArea(r)) < 0.05) return;
      rings.push(r);
    });
    if (rings.length && ringArea(poly[0].length ? rings[0] : rings[0]) !== 0) result.push({ rings });
  }
  return result;
}
// Only keep a hole if its outer ring survived: rings after index 0 of a dropped outer are meaningless.
function projectClean(polys) {
  const out = [];
  for (const poly of polys) {
    const outer = (() => {
      const o = poly[0];
      let r = o.slice(0, o[0][0] === o.at(-1)[0] && o[0][1] === o.at(-1)[1] ? -1 : undefined);
      r = densify(r);
      if (r.length < 3) return null;
      r = clipRing(r.map(([lo, la]) => project(lo, la)), viewWindow.inside, viewWindow.cross);
      return r.length >= 3 && Math.abs(ringArea(r)) >= 0.05 ? r : null;
    })();
    if (!outer) continue;
    const rings = [outer];
    for (const h of poly.slice(1)) {
      let r = h.slice(0, h[0][0] === h.at(-1)[0] && h[0][1] === h.at(-1)[1] ? -1 : undefined);
      r = densify(r);
      if (r.length < 3) continue;
      r = clipRing(r.map(([lo, la]) => project(lo, la)), viewWindow.inside, viewWindow.cross);
      if (r.length >= 3 && Math.abs(ringArea(r)) >= 0.05) rings.push(r);
    }
    out.push({ rings });
  }
  return out;
}

const shapes = new Map();
for (const a3 of [...COLOURED, ...CONTEXT]) {
  if (!rawByOwner.has(a3)) continue;
  const polys = projectClean(rawByOwner.get(a3));
  if (polys.length) shapes.set(a3, polys);
}
// Remaining Natural Earth shapes of neighbours not listed above (Russia is in EUROPE; others are grey).
for (const [a3, raw] of rawByOwner) {
  if (shapes.has(a3) || COLOURED.includes(a3) || CONTEXT.includes(a3)) continue;
  const polys = projectClean(raw);
  if (polys.length) shapes.set(a3, polys);
}

const areaOf = (polys) => polys.reduce((s, p) => s + Math.abs(ringArea(p.rings[0])), 0);
const bigPolys = (polys, a3) => {
  // Main landmass(es): drop specks below 0.5% of the country's visible area for labelling.
  const total = areaOf(polys);
  return polys.filter((p) => Math.abs(ringArea(p.rings[0])) >= total * 0.04 || polys.length === 1);
};

// ---------- colouring: no two neighbours (by land or a narrow sea) share a colour ----------

const adjacency = new Map(EUROPE.map((a) => [a, new Set()]));
const link = (a, b) => { if (adjacency.has(a) && adjacency.has(b) && a !== b) { adjacency.get(a).add(b); adjacency.get(b).add(a); } };
for (const c of countries) for (const b of c.borders || []) link(c.alpha3Code, b);
for (const [a, b] of R.links) link(a, b);

function colourGraph(nodes, adj, k) {
  // DSATUR, then verify; falls back to more colours only if k is too few.
  const colour = new Map();
  const order = [...nodes];
  while (colour.size < nodes.length) {
    let best = null, bestSat = -1, bestDeg = -1;
    for (const n of order) {
      if (colour.has(n)) continue;
      const sat = new Set([...adj.get(n)].filter((m) => colour.has(m)).map((m) => colour.get(m))).size;
      const deg = adj.get(n).size;
      if (sat > bestSat || (sat === bestSat && deg > bestDeg)) { best = n; bestSat = sat; bestDeg = deg; }
    }
    const used = new Set([...adj.get(best)].filter((m) => colour.has(m)).map((m) => colour.get(m)));
    let c = 0;
    while (used.has(c)) c++;
    if (c >= k) throw new Error(`Needs more than ${k} colours at ${best}`);
    colour.set(best, c);
  }
  return colour;
}
const PALETTE_SIZE = 6;
const colours = colourGraph(EUROPE.filter((a) => shapes.has(a)), new Map([...adjacency].filter(([a]) => shapes.has(a)).map(([a, s]) => [a, new Set([...s].filter((b) => shapes.has(b)))])), PALETTE_SIZE);
for (const [a, parent] of Object.entries(R.share)) colours.set(a, colours.get(parent)); // e.g. Greenland: part of the Kingdom of Denmark

// ---------- text fitting ----------

// Helvetica/Arial Bold advance widths (per 1000 em) for the capitals the labels use.
const W = { A: 722, B: 722, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 556, K: 722, L: 611, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, " ": 278, "-": 333, ".": 278 };
const LOWER = { a: 556, b: 611, c: 556, d: 611, e: 556, f: 333, g: 611, h: 611, i: 278, j: 278, k: 556, l: 278, m: 889, n: 611, o: 611, p: 611, q: 611, r: 389, s: 556, t: 333, u: 611, v: 556, w: 778, x: 556, y: 556, z: 500 };
function textWidth(text, size, spacing = 0) {
  let w = 0;
  for (const ch of text.normalize("NFD").replace(/[̀-ͯ]/g, "")) w += (W[ch] ?? LOWER[ch] ?? 600) / 1000 * size + spacing * size;
  return w;
}
const CAP_H = 0.72;

// Rasterise a country's main polygons (with holes) into a coverage grid, optionally rotated.
const CELL = 2;
function rasterise(polys, angle, extraBlocked) {
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  const rot = (p) => [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos];
  const rp = polys.map((poly) => poly.rings.map((r) => r.map(rot)));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of rp) for (const [x, y] of poly[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cols = Math.ceil((x1 - x0) / CELL) + 1, rows = Math.ceil((y1 - y0) / CELL) + 1;
  const grid = new Uint8Array(cols * rows);
  for (const poly of rp) {
    for (let j = 0; j < rows; j++) {
      const y = y0 + (j + 0.5) * CELL;
      const xs = [];
      for (const ring of poly) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          if ((a[1] <= y) !== (b[1] <= y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] - x0) / CELL - 0.5)), i1 = Math.min(cols - 1, Math.floor((xs[k + 1] - x0) / CELL - 0.5));
        for (let i = i0; i <= i1; i++) grid[j * cols + i] ^= 1;
      }
    }
  }
  // Keep only the part of the polygon inside the visible frame.
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (!grid[j * cols + i]) continue;
    const x = x0 + (i + 0.5) * CELL, y = y0 + (j + 0.5) * CELL;
    const ox = x * Math.cos(angle) - y * Math.sin(angle), oy = x * Math.sin(angle) + y * Math.cos(angle);
    if (ox < 4 || ox > WIDTH - 4 || oy < 4 || oy > HEIGHT - 4) { grid[j * cols + i] = 0; continue; }
    if (extraBlocked && extraBlocked.some(([bx0, by0, bx1, by1]) => ox >= bx0 && ox <= bx1 && oy >= by0 && oy <= by1)) grid[j * cols + i] = 0;
  }
  // Summed-area table.
  const sat = new Int32Array((cols + 1) * (rows + 1));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    sat[(j + 1) * (cols + 1) + i + 1] = grid[j * cols + i] + sat[j * (cols + 1) + i + 1] + sat[(j + 1) * (cols + 1) + i] - sat[j * (cols + 1) + i];
  }
  return { x0, y0, cols, rows, sat, angle };
}
const full = (g, i0, j0, w, h) => {
  const s = g.sat, c = g.cols + 1;
  return s[(j0 + h) * c + i0 + w] - s[j0 * c + i0 + w] - s[(j0 + h) * c + i0] + s[j0 * c + i0] === w * h;
};
// Best rectangle position of text size `size` (w x h in SVG units) in a raster; returns centre in SVG coords.
function placeRect(g, w, h) {
  const cw = Math.ceil(w / CELL), ch = Math.ceil(h / CELL);
  if (cw > g.cols || ch > g.rows) return null;
  let sx = 0, sy = 0, n = 0;
  const hits = [];
  for (let j = 0; j + ch <= g.rows; j++) for (let i = 0; i + cw <= g.cols; i++) {
    if (full(g, i, j, cw, ch)) { sx += i; sy += j; n++; hits.push([i, j]); }
  }
  if (!n) return null;
  const mx = sx / n, my = sy / n;
  let best = hits[0], bd = Infinity;
  for (const [i, j] of hits) { const d = (i - mx) ** 2 + (j - my) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
  const lx = g.x0 + (best[0] + cw / 2) * CELL, ly = g.y0 + (best[1] + ch / 2) * CELL;
  const cos = Math.cos(g.angle), sin = Math.sin(g.angle);
  return [lx * cos - ly * sin, lx * sin + ly * cos];
}

// Variants of a name: one line, or two lines split at a space.
function nameVariants(name) {
  const up = name.toUpperCase();
  const out = [{ lines: [up] }];
  const words = up.split(" ");
  if (words.length > 1) {
    for (let k = 1; k < words.length; k++) out.push({ lines: [words.slice(0, k).join(" "), words.slice(k).join(" ")] });
  }
  return out;
}
const SPACING = 0.05;
const LINE_H = 1.08;
function fitLabel(polys, name, { maxSize, minSize, blocked, angles = [0] }) {
  const rasters = new Map(angles.map((a) => [a, rasterise(polys, a, blocked)]));
  let best = null;
  for (const angle of angles) {
    const g = rasters.get(angle);
    for (const variant of nameVariants(name)) {
      for (let size = maxSize; size >= minSize; size -= 0.5) {
        const w = Math.max(...variant.lines.map((l) => textWidth(l, size, SPACING))) + size * 0.3;
        const h = (variant.lines.length - 1) * size * LINE_H + size * CAP_H + size * 0.3;
        const pos = placeRect(g, w, h);
        if (!pos) continue;
        // Prefer horizontal unless a tilt buys 25% more size; prefer one line unless two lines buys 12%.
        const score = size * (angle === 0 ? 1.25 : 1) * (variant.lines.length === 1 ? 1.12 : 1);
        if (!best || score > best.score) best = { size, pos, angle, lines: variant.lines, score, w, h };
        break;
      }
    }
  }
  return best;
}

// ---------- labels, capitals, callouts ----------

const obstacles = []; // [x0,y0,x1,y1] already used by capital names, dots, callouts
const boxOverlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

// Tiny states: label sits outside with a pointer line. dx/dy are offsets of the label anchor from the
// capital marker, in SVG units; `anchor` is the text-anchor.
const MICRO = R.micro; // the only countries that get pointer lines
const CALLOUTS = Object.fromEntries(MICRO.map((a) => [a, true]));
// Capital-name placement overrides ("r" right, "l" left, "t" above, "b" below).
const CAP_SIDE = {};
const CAP_SKIP_NAME = new Set(Object.keys(CALLOUTS)); // their callout carries the name

const capitalPoint = (a3) => {
  const key = a3 === "UNK" ? "KOS" : a3;
  const c = capitals[key];
  return c ? { name: c.name, xy: project(c.lon, c.lat) } : null;
};

const labelOut = []; // {a3, name, lines, size, x, y, angle, kind}
const capOut = [];   // {name, x, y, nx, ny, anchor}
const calloutOut = [];

// 1) capital dots first (their names are placed last, after the country labels)
const CAP_SIZE = 9;
const insidePoly = (polys, x, y) => polys.some((p) => {
  let inside = false;
  for (const ring of p.rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
});
const capDots = [];
for (const a3 of EUROPE) {
  const cap = capitalPoint(a3);
  if (!cap || !shapes.has(a3)) continue;
  const [x, y] = cap.xy;
  if (x < 6 || x > WIDTH - 6 || y < 6 || y > HEIGHT - 6) continue;
  obstacles.push([x - 4, y - 4, x + 4, y + 4]);
  capDots.push({ a3, cap, x, y });
}

// 2) country labels
const TILTS = [0, -0.35, 0.35, -0.7, 0.7, -1.05, 1.05, Math.PI / 2];
const unlabelled = [];
function labelCountry(a3, { context }) {
  const polys = bigPolys(shapes.get(a3), a3);
  const fit = fitLabel(polys, nameOf(a3), {
    maxSize: context ? CONTEXT_LABEL_MAX : 26,
    minSize: context ? 10 : 8.5,
    blocked: obstacles,
    angles: context ? [0] : TILTS,
  });
  if (!fit) { unlabelled.push(a3); return; }
  labelOut.push({ a3, name: nameOf(a3), lines: fit.lines, size: fit.size, x: fit.pos[0], y: fit.pos[1], angle: fit.angle, kind: context ? "context" : "country" });
  const c = Math.abs(Math.cos(fit.angle)), sn = Math.abs(Math.sin(fit.angle));
  const hw = (fit.w * c + fit.h * sn) / 2 + 1, hh = (fit.w * sn + fit.h * c) / 2 + 1;
  const ob = [fit.pos[0] - hw, fit.pos[1] - hh, fit.pos[0] + hw, fit.pos[1] + hh];
  if (fit.angle) ob.rot = { cx: fit.pos[0], cy: fit.pos[1], w: fit.w + 2, h: fit.h + 2, angle: fit.angle }; // the true tilted rectangle inside that bounding box
  obstacles.push(ob);
}
// Largest first so the big countries claim their best spots.
const byArea = (list) => [...list].sort((a, b) => areaOf(shapes.get(b)) - areaOf(shapes.get(a)));
for (const a3 of byArea(COLOURED.filter((a) => shapes.has(a) && !CALLOUTS[a]))) {
  // Only the visible part matters; a country almost entirely outside the frame gets no label.
  labelCountry(a3, { context: false });
}
for (const a3 of byArea(CONTEXT.filter((a) => shapes.has(a)))) labelCountry(a3, { context: true });

// Land mask (2-unit cells) so "is this spot sea?" and "which countries does a line cross?" are cheap.
const MASK = 2;
const maskCols = Math.ceil(WIDTH / MASK), maskRows = Math.ceil(HEIGHT / MASK);
const maskId = new Int16Array(maskCols * maskRows); // 0 = sea, else index+1 into maskCodes
const maskCodes = [...shapes.keys()];
maskCodes.forEach((a3, idx) => {
  for (const poly of shapes.get(a3)) {
    for (let j = 0; j < maskRows; j++) {
      const y = (j + 0.5) * MASK, xs = [];
      for (const ring of poly.rings) for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        if ((p[1] <= y) !== (q[1] <= y)) xs.push(p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
      }
      xs.sort((m, n) => m - n);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil(xs[k] / MASK - 0.5)), i1 = Math.min(maskCols - 1, Math.floor(xs[k + 1] / MASK - 0.5));
        for (let i = i0; i <= i1; i++) maskId[j * maskCols + i] = idx + 1;
      }
    }
  }
});
const countryAtMask = (x, y) => {
  const i = Math.floor(x / MASK), j = Math.floor(y / MASK);
  if (i < 0 || j < 0 || i >= maskCols || j >= maskRows) return null;
  const v = maskId[j * maskCols + i];
  return v ? maskCodes[v - 1] : null;
};
const CALL_SIZE = 10, CALL_LINE = 11.5;

// 3) pointer-line callouts for the micro-states: the nearest open water where the label fits (one or two
// lines), preferring short lines that cross few other countries.
const MICRO_FIXED = R.microFixed, MICRO_SIDE = R.microSide;
function placeMicro(a3) {
  const cap = capitalPoint(a3);
  if (!cap) return;
  const [x, y] = cap.xy;
  const name = nameOf(a3).toUpperCase();
  const words = name.split(" ");
  const variants = [[name]];
  if (words.length > 1) variants.push([words.slice(0, 1).join(" "), words.slice(1).join(" ")]);
  let best = null;
  // Liechtenstein: a short line north into southern Germany (by Lake Constance) rather than the far-off Mediterranean,
  // so it is not confused with Monaco. If that spot is taken by another label, fall through to the open-water search.
  if (MICRO_FIXED[a3]) {
    const [fx, fy] = MICRO_FIXED[a3];
    const lines = variants[0], w = textWidth(lines[0], CALL_SIZE, 0.04) + 4, h = CALL_LINE + 1;
    const box = [fx - w / 2, fy - h / 2, fx + w / 2, fy + h / 2];
    if (!obstacles.some((o) => boxOverlap(o, box))) {
      const nx = Math.min(Math.max(x, box[0]), box[2]), ny = Math.min(Math.max(y, box[1]), box[3]);
      obstacles.push(box);
      calloutOut.push({ a3, name: nameOf(a3), x, y, lines, box, nx, ny, onLand: true });
      console.log(`callout ${nameOf(a3)}: line ${Math.round(Math.hypot(nx - x, ny - y))} long, placed on land at its fixed spot`);
      return;
    }
    console.log(`note: fixed spot for ${nameOf(a3)} is taken; using open water instead`);
  }
  for (const lines of variants) {
    const w = Math.max(...lines.map((l) => textWidth(l, CALL_SIZE, 0.04))) + 4, h = lines.length * CALL_LINE + 1;
    for (let cy = y - 190; cy <= y + 190; cy += 4) for (let cx = x - 190; cx <= x + 190; cx += 4) {
      if (MICRO_SIDE[a3] === "east" && cx < x + 8) continue;
      if (MICRO_SIDE[a3] === "west" && cx > x - 8) continue;
      const box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
      if (box[0] < 8 || box[2] > WIDTH - 8 || box[1] < 8 || box[3] > HEIGHT - 8) continue;
      if (obstacles.some((o) => boxOverlap(o, box))) continue;
      let wet = true;
      for (let i = 0; i <= 14 && wet; i++) for (let j = 0; j <= 4; j++) if (countryAtMask(box[0] - 0.5 + ((box[2] - box[0] + 1) * i) / 14, box[1] - 0.5 + ((box[3] - box[1] + 1) * j) / 4)) { wet = false; break; }
      if (!wet) continue;
      const nx = Math.min(Math.max(x, box[0]), box[2]), ny = Math.min(Math.max(y, box[1]), box[3]);
      const d = Math.hypot(nx - x, ny - y);
      if (d > (best ? best.score : 400)) continue;
      const crossed = new Set();
      for (let t = 1; t < 30; t++) { const c = countryAtMask(x + ((nx - x) * t) / 30, y + ((ny - y) * t) / 30); if (c && c !== a3) crossed.add(c); }
      const score = d + 22 * crossed.size + (lines.length === 2 ? 4 : 0);
      if (!best || score < best.score) best = { score, d, crossed: crossed.size, lines, w, h, box, nx, ny };
    }
  }
  if (!best) { console.log(`WARNING: no open water found for ${a3}`); return; }
  obstacles.push(best.box);
  calloutOut.push({ a3, name: nameOf(a3), x, y, lines: best.lines, box: best.box, nx: best.nx, ny: best.ny });
  console.log(`callout ${nameOf(a3)}: line ${Math.round(best.d)} long, crosses ${best.crossed} other countr${best.crossed === 1 ? "y" : "ies"}`);
}
for (const a3 of MICRO) placeMicro(a3);
// 3a) countries too small for a full-size label: a small label centred on the country that may spill
// over its borders (as on the reference map); a pointer-line callout only if even that does not fit.
const allShapes = [...shapes.values()];
const onLand = (x, y) => allShapes.some((polys) => insidePoly(polys, x, y));
const autoCallouts = [];
const spilled = new Set();
function centroidOf(polys) {
  const ring = polys.reduce((m, p) => (Math.abs(ringArea(p.rings[0])) > Math.abs(ringArea(m.rings[0])) ? p : m)).rings[0];
  let cx = 0, cy = 0, a2 = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], cr = p[0] * q[1] - q[0] * p[1];
    a2 += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr;
  }
  return [cx / (3 * a2), cy / (3 * a2)];
}
const SPILL_SIZES = [8, 7.5, 7, 6.5];
const OFFS = [[0, 0], [0, -9], [0, 9], [-10, 0], [10, 0], [-10, -9], [10, -9], [-10, 9], [10, 9], [0, -18], [0, 18], [-20, 0], [20, 0], [-20, -12], [20, -12], [-20, 12], [20, 12], [0, -27], [0, 27], [-32, 0], [32, 0]];
for (const a3 of byArea(unlabelled.filter((a) => EUROPE.includes(a)))) {
  const polys = bigPolys(shapes.get(a3), a3);
  const [gx, gy] = centroidOf(polys);
  const long = nameOf(a3).length > 11;
  const variants = nameVariants(nameOf(a3)).filter((v) => (long ? v.lines.length === 2 : v.lines.length === 1)).slice(0, 3);
  let best = null;
  for (const SPILL_SIZE of SPILL_SIZES) {
    for (const v of variants) {
      const w = Math.max(...v.lines.map((l) => textWidth(l, SPILL_SIZE, SPACING))) + 3;
      const h = (v.lines.length - 1) * SPILL_SIZE * LINE_H + SPILL_SIZE * CAP_H + 3;
      for (const [ox, oy] of OFFS) {
        const x = gx + ox, y = gy + oy;
        const box = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
        if (box[0] < 6 || box[2] > WIDTH - 6 || box[1] < 6 || box[3] > HEIGHT - 6) continue;
        if (obstacles.some((o) => boxOverlap(o, box))) continue;
        let inside = 0;
        for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) if (insidePoly(polys, box[0] + (w * i) / 4, box[1] + (h * j) / 2)) inside++;
        const score = inside * 2 - Math.hypot(ox, oy) * 0.05 - (v.lines.length === 2 ? 0.5 : 0) + SPILL_SIZE;
        if (inside >= 6 && (!best || score > best.score)) best = { score, x, y, v, box, inside, size: SPILL_SIZE };
      }
    }
    if (best) break;
  }
  if (best) {
    obstacles.push(best.box);
    // A label sitting mostly outside its country gets a short leader to the capital's dot.
    const cap = capitalPoint(a3);
    let leader = null;
    if (cap && best.inside < 6) {
      const [cx, cy] = cap.xy;
      const nx = Math.min(Math.max(cx, best.box[0]), best.box[2]), ny = Math.min(Math.max(cy, best.box[1]), best.box[3]);
      if (Math.hypot(nx - cx, ny - cy) > 3) leader = [nx, ny, cx, cy];
    }
    labelOut.push({ a3, name: nameOf(a3), lines: best.v.lines, size: best.size, x: best.x, y: best.y, angle: 0, kind: "country", leader });
    spilled.add(a3);
  }
}
for (const a3 of unlabelled.filter((a) => EUROPE.includes(a) && !spilled.has(a))) {
  // Last resort: a tiny label near the country's centre, on the free spot closest to it.
  const [gx, gy] = centroidOf(bigPolys(shapes.get(a3), a3));
  const text = nameOf(a3).toUpperCase();
  const w = textWidth(text, 6.5, SPACING) + 3, h = 6.5 * CAP_H + 3;
  let pick = null;
  for (let oy = -30; oy <= 30; oy += 3) for (let ox = -40; ox <= 40; ox += 3) {
    const box = [gx + ox - w / 2, gy + oy - h / 2, gx + ox + w / 2, gy + oy + h / 2];
    if (obstacles.some((o) => boxOverlap(o, box))) continue;
    const d = Math.hypot(ox, oy);
    if (!pick || d < pick.d) pick = { d, x: gx + ox, y: gy + oy, box };
  }
  pick = pick || { x: gx, y: gy, box: [gx - w / 2, gy - h / 2, gx + w / 2, gy + h / 2] };
  obstacles.push(pick.box);
  labelOut.push({ a3, name: nameOf(a3), lines: [text], size: 6.5, x: pick.x, y: pick.y, angle: 0, kind: "country", leader: null });
  spilled.add(a3);
  console.log(`note: ${nameOf(a3)} got a 6.5px label`);
}
// 4) capital names, wherever they fit without covering a country label (dropped when crowded)
for (const { a3, cap, x, y } of capDots) {
  if (CAP_SKIP_NAME.has(a3) || autoCallouts.some((c) => c.a3 === a3)) { capOut.push({ name: null, x, y }); continue; }
  const w = textWidth(cap.name, CAP_SIZE) * 0.97 + 2, h = CAP_SIZE * 0.9;
  const sides = {
    r: { box: [x + 5, y - h / 2, x + 5 + w, y + h / 2], nx: x + 5.5, ny: y + h * 0.34, anchor: "start" },
    l: { box: [x - 5 - w, y - h / 2, x - 5, y + h / 2], nx: x - 5.5, ny: y + h * 0.34, anchor: "end" },
    t: { box: [x - w / 2, y - 5 - h, x + w / 2, y - 5], nx: x, ny: y - 6.5, anchor: "middle" },
    b: { box: [x - w / 2, y + 5, x + w / 2, y + 5 + h], nx: x, ny: y + 5 + h * 0.85, anchor: "middle" },
    tr: { box: [x + 3, y - 4 - h, x + 3 + w, y - 4], nx: x + 3.5, ny: y - 5.5, anchor: "start" },
    tl: { box: [x - 3 - w, y - 4 - h, x - 3, y - 4], nx: x - 3.5, ny: y - 5.5, anchor: "end" },
    br: { box: [x + 3, y + 4, x + 3 + w, y + 4 + h], nx: x + 3.5, ny: y + 4 + h * 0.85, anchor: "start" },
    bl: { box: [x - 3 - w, y + 4, x - 3, y + 4 + h], nx: x - 3.5, ny: y + 4 + h * 0.85, anchor: "end" },
  };
  const own = shapes.get(a3);
  // A capital name may sit in the empty corner of a tilted label's bounding box, if R.preciseLabelBoxes (new maps; Europe keeps its approved layout).
  const hitsTilted = (o, b) => {
    const c = Math.cos(-o.rot.angle), sn = Math.sin(-o.rot.angle);
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 2; j++) {
      const dx = b[0] + ((b[2] - b[0]) * i) / 8 - o.rot.cx, dy = b[1] + ((b[3] - b[1]) * j) / 2 - o.rot.cy;
      if (Math.abs(dx * c - dy * sn) <= o.rot.w / 2 && Math.abs(dx * sn + dy * c) <= o.rot.h / 2) return true;
    }
    return false;
  };
  const blockedBy = (o, b) => boxOverlap(o, b) && (!R.preciseLabelBoxes || !o.rot || hitsTilted(o, b));
  const ok = (side) => side.box[0] >= 4 && side.box[2] <= WIDTH - 4 && side.box[1] >= 4 && side.box[3] <= HEIGHT - 4 && !obstacles.some((o, i) => i >= capDots.length && blockedBy(o, side.box));
  const inOwn = (side) => [[side.box[0], side.box[1]], [side.box[2], side.box[1]], [side.box[0], side.box[3]], [side.box[2], side.box[3]]].every(([cx, cy]) => insidePoly(own, cx, cy));
  const free = ["r", "l", "b", "t", "tr", "tl", "br", "bl"].map((k) => sides[k]).filter(ok);
  const chosen = free.find(inOwn) || free[0];
  if (chosen) { obstacles.push(chosen.box); capOut.push({ name: cap.name, x, y, nx: chosen.nx, ny: chosen.ny, anchor: chosen.anchor }); }
  else capOut.push({ name: null, x, y });
}
function area_ok(a3) { return areaOf(shapes.get(a3)) > 6000; } // big enough that a name just outside its border is not confusing


// Audit: no pointer-line label (and no small in-place label) may sit on top of a different country.
function auditBox(a3, name, x0, x1, y0, y1) {
  const hits = new Set();
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 3; j++) { const h = countryAtMask(x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * j) / 3); if (h && h !== a3) hits.add(h); }
  if (hits.size) console.log(`WARNING: "${name}" overlaps ${[...hits].join(", ")}`);
}
for (const c of calloutOut.filter((c) => !c.onLand)) auditBox(c.a3, c.name, c.box[0], c.box[2], c.box[1], c.box[3]);
for (const l of labelOut.filter((l) => l.kind === "country" && l.size <= 9 && !l.angle)) {
  const w = Math.max(...l.lines.map((t) => textWidth(t, l.size, SPACING)));
  const h = l.lines.length * l.size * 0.9;
  auditBox(l.a3, l.name + " (in place)", l.x - w / 2, l.x + w / 2, l.y - h / 2, l.y + h / 2);
}

// ---------- sea and ocean labels (positions in lon/lat; rotation in degrees) ----------

const SEAS = R.seas;
const seaHits = (t, x, y, size, rot, sp) => {
  const w = textWidth(t, size, sp), ang = (rot * Math.PI) / 180;
  let n = 0;
  for (let i = 0; i <= 24; i++) for (const dy of [-size * 0.45, size * 0.35]) {
    const u = -w / 2 + (w * i) / 24;
    const px = x + u * Math.cos(ang) - dy * Math.sin(ang), py = y + u * Math.sin(ang) + dy * Math.cos(ang);
    if (countryAtMask(px, py) || obstacles.some((o) => px >= o[0] - 1 && px <= o[2] + 1 && py >= o[1] - 1 && py <= o[3] + 1)) n++; // land, or on top of another label
  }
  return n;
};
// A sea name must sit fully in open water: nudge it (position, rotation, and if need be size) until it does.
const seaOut = SEAS.map((s) => {
  const [x, y] = project(s.lon, s.lat);
  let best = { ...s, x, y };
  if (seaHits(s.t, x, y, s.size, s.rot, s.sp)) {
    let pick = null;
    for (let size = s.size; size >= Math.max(7.5, s.size - 3); size -= 0.5)
      for (const dr of [0, -12, 12, -25, 25]) for (let oy = -60; oy <= 60; oy += 3) for (let ox = -60; ox <= 60; ox += 3) {
        if (seaHits(s.t, x + ox, y + oy, size, s.rot + dr, s.sp)) continue;
        const cost = Math.hypot(ox, oy) + (s.size - size) * 10 + Math.abs(dr) * 0.5;
        if (!pick || cost < pick.cost) pick = { cost, x: x + ox, y: y + oy, size, rot: s.rot + dr };
      }
    if (pick) best = { ...s, x: pick.x, y: pick.y, size: pick.size, rot: pick.rot };
  }
  return best;
}).filter((s) => s.x > 0 && s.x < WIDTH && s.y > 0 && s.y < HEIGHT);

// Audit: sea and ocean names must sit fully in open water.
for (const t of seaOut) {
  const w = textWidth(t.t, t.size, t.sp);
  const ang = (t.rot * Math.PI) / 180, hits = new Set();
  for (let i = 0; i <= 24; i++) for (const dy of [-t.size * 0.4, t.size * 0.3]) {
    const u = -w / 2 + (w * i) / 24;
    const px = t.x + u * Math.cos(ang) - dy * Math.sin(ang), py = t.y + u * Math.sin(ang) + dy * Math.cos(ang);
    const h = countryAtMask(px, py); if (h) hits.add(h);
  }
  if (hits.size) console.log(`WARNING: sea label "${t.t}" overlaps ${[...hits].join(", ")}`);
}

// ---------- SVG ----------

const f1 = num;
const pathOf = (polys) =>
  polys.map((p) => p.rings.map((r) => "M" + r.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L") + "Z").join("")).join("");

const landMarkup = (() => {
  const euro = COLOURED.filter((a) => shapes.has(a))
    .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    .map((a) => `<path class="c c${colours.get(a)}" data-code="${a}" d="${pathOf(shapes.get(a))}"><title>${esc(nameOf(a))}</title></path>`)
    .join("\n      ");
  const grey = [...shapes.keys()]
    .filter((a) => !COLOURED.includes(a))
    .map((a) => `<path class="c ctx" d="${pathOf(shapes.get(a))}" />`)
    .join("\n      ");
  return { euro, grey };
})();

function textLines(lines, size) {
  if (lines.length === 1) return esc(lines[0]);
  const first = -((lines.length - 1) * size * LINE_H) / 2;
  return lines.map((l, i) => `<tspan x="0" dy="${f1(i === 0 ? first : size * LINE_H)}">${esc(l)}</tspan>`).join("");
}
const spillLeaders = labelOut
  .filter((l) => l.leader)
  .map((l) => `<line class="leader" x1="${f1(l.leader[0])}" y1="${f1(l.leader[1])}" x2="${f1(l.leader[2])}" y2="${f1(l.leader[3])}" />`)
  .join("\n      ");
const countryLabels = labelOut
  .map((l) => {
    const rot = l.angle ? ` rotate(${f1((l.angle * 180) / Math.PI)})` : "";
    return `<text class="lbl ${l.kind}" transform="translate(${f1(l.x)} ${f1(l.y)})${rot}" font-size="${f1(l.size)}" dy="${f1(l.size * CAP_H * 0.5)}">${textLines(l.lines, l.size)}</text>`;
  })
  .join("\n      ");
const capMarkup = capOut
  .map((c) => `<circle class="cap" cx="${f1(c.x)}" cy="${f1(c.y)}" r="2.6" />` + (c.name ? `<text class="capname" x="${f1(c.nx)}" y="${f1(c.ny)}" text-anchor="${c.anchor}" font-size="${CAP_SIZE}">${esc(c.name)}</text>` : ""))
  .join("\n      ");
const calloutLines = calloutOut
  .map((c) => `<line class="leader" x1="${f1(c.x)}" y1="${f1(c.y)}" x2="${f1(c.nx)}" y2="${f1(c.ny)}" />`)
  .join("\n      ");
const calloutTexts = calloutOut
  .map((c) => {
    const cx = (c.box[0] + c.box[2]) / 2;
    const top = (c.box[1] + c.box[3]) / 2 - ((c.lines.length - 1) * CALL_LINE) / 2 + CALL_SIZE * 0.36;
    const tspans = c.lines.map((l, i) => `<tspan x="${f1(cx)}" y="${f1(top + i * CALL_LINE)}">${esc(l)}</tspan>`).join("");
    return `<text class="lbl small" font-size="${CALL_SIZE}" text-anchor="middle">${tspans}</text>`;
  })
  .join("\n      ");
const calloutMarkup = `${calloutLines}\n      ${calloutTexts}`; // every line first, so a text's halo cuts any line that passes behind it

const seaMarkup = seaOut
  .map((s) => `<text class="sea" transform="translate(${f1(s.x)} ${f1(s.y)}) rotate(${s.rot})" text-anchor="middle" font-size="${s.size}" letter-spacing="${s.sp}em">${esc(s.t)}</text>`)
  .join("\n      ");

const svg = `<svg class="map-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="map-title map-desc" xmlns="http://www.w3.org/2000/svg">
    <title id="map-title">Political map of ${R.name}</title>
    <desc id="map-desc">${R.name}'s countries, each in a color that differs from its neighbors, with country names, capital cities and the surrounding seas labeled.</desc>
    <defs>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="1.5" dy="3" stdDeviation="3" class="shadow-flood" /></filter>
      <clipPath id="frame"><rect width="${WIDTH}" height="${HEIGHT}" rx="14" /></clipPath>
    </defs>
    <g clip-path="url(#frame)">
      <rect class="ocean" width="${WIDTH}" height="${HEIGHT}" />
      <g class="seas">
      ${seaMarkup}
      </g>
      <g class="land" filter="url(#shadow)">
      ${landMarkup.grey}
      ${landMarkup.euro}
      </g>
      <g class="labels">
      ${countryLabels}
      </g>
      <g class="callouts">
      ${spillLeaders}
      ${calloutMarkup}
      </g>
      <g class="capitals">
      ${capMarkup}
      </g>
    </g>
  </svg>`;

// ---------- page ----------

const THEME_SNIPPET = `try{var s=localStorage.getItem(${JSON.stringify(DARK_MODE_KEY)});var d=s===null?matchMedia("(prefers-color-scheme: dark)").matches:s==="true";document.documentElement.classList.toggle("dark",d)}catch(e){}`;
const TOGGLE_SNIPPET = `(function(){var b=document.getElementById("dark-mode-toggle"),i=document.getElementById("dark-mode-icon"),r=document.documentElement;function sync(){var d=r.classList.contains("dark");b.setAttribute("aria-pressed",String(d));i.textContent=d?"\\u2600\\uFE0F":"\\uD83C\\uDF19"}sync();b.addEventListener("click",function(){var d=!r.classList.contains("dark");r.classList.toggle("dark",d);try{localStorage.setItem(${JSON.stringify(DARK_MODE_KEY)},String(d))}catch(e){}sync()})})();`;

// Phone viewer: a tap on the map opens it full screen; one finger drags, two fingers pinch, the buttons zoom.
const VIEWER_SNIPPET = `(function(){
var open=document.getElementById("map-open"),viewer=document.getElementById("map-viewer"),stage=document.getElementById("map-stage");
if(!open||!viewer||!stage)return;
var narrow=window.matchMedia("(max-width: 700px)"),svg=null,s=1,tx=0,ty=0,base=1,w0=0,h0=0,MAX=10,pts={},last=null,pushed=false,pinch=null;
function size(){var r=stage.getBoundingClientRect();return[r.width,r.height]}
function clamp(){var sz=size(),W=w0*s,H=h0*s;
 tx=W<=sz[0]?(sz[0]-W)/2:Math.min(0,Math.max(sz[0]-W,tx));ty=H<=sz[1]?(sz[1]-H)/2:Math.min(0,Math.max(sz[1]-H,ty))}
function apply(){clamp();svg.style.transform="translate("+tx+"px,"+ty+"px) scale("+s+")"}
function zoomAt(f,cx,cy){var n=Math.min(MAX,Math.max(1,s*f));f=n/s;tx=cx-(cx-tx)*f;ty=cy-(cy-ty)*f;s=n;apply()}
function fit(){var sz=size(),ratio=svg.viewBox.baseVal.height/svg.viewBox.baseVal.width;w0=sz[0];h0=w0*ratio;
 svg.style.width=w0+"px";svg.style.height=h0+"px";
 s=Math.min(3,Math.max(1,sz[1]/h0));tx=(sz[0]-w0*s)/2;ty=(sz[1]-h0*s)/2;apply()}
function show(){svg=open.querySelector("svg").cloneNode(true);svg.removeAttribute("class");svg.setAttribute("class","map-svg map-svg-big");
 svg.style.minWidth="0";stage.innerHTML="";stage.appendChild(svg);viewer.hidden=false;document.documentElement.classList.add("map-viewer-open");
 fit();document.getElementById("map-close").focus();try{history.pushState({mapViewer:1},"");pushed=true}catch(e){}}
function hide(fromPop){if(viewer.hidden)return;viewer.hidden=true;document.documentElement.classList.remove("map-viewer-open");stage.innerHTML="";svg=null;
 if(pushed&&!fromPop){pushed=false;try{history.back()}catch(e){}}pushed=false;open.focus()}
open.addEventListener("click",function(){if(narrow.matches)show()});
window.addEventListener("popstate",function(){if(!viewer.hidden)hide(true)});
document.addEventListener("keydown",function(e){if(!viewer.hidden&&e.key==="Escape")hide()});
document.getElementById("map-close").addEventListener("click",function(){hide()});
function center(){var sz=size();return[sz[0]/2,sz[1]/2]}
document.getElementById("map-zoom-in").addEventListener("click",function(){var c=center();zoomAt(1.6,c[0],c[1])});
document.getElementById("map-zoom-out").addEventListener("click",function(){var c=center();zoomAt(1/1.6,c[0],c[1])});
document.getElementById("map-zoom-reset").addEventListener("click",function(){fit()});
window.addEventListener("resize",function(){if(!viewer.hidden)fit()});
function rel(e){var r=stage.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]}
stage.addEventListener("pointerdown",function(e){stage.setPointerCapture(e.pointerId);pts[e.pointerId]=rel(e);last=null;pinch=null});
stage.addEventListener("pointermove",function(e){if(!pts[e.pointerId])return;var p=rel(e),prev=pts[e.pointerId];pts[e.pointerId]=p;var ids=Object.keys(pts);
 if(ids.length===1){tx+=p[0]-prev[0];ty+=p[1]-prev[1];apply()}
 else if(ids.length===2){var a=pts[ids[0]],b=pts[ids[1]],d=Math.hypot(a[0]-b[0],a[1]-b[1]),m=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  if(pinch){tx+=m[0]-pinch.m[0];ty+=m[1]-pinch.m[1];zoomAt(d/pinch.d,m[0],m[1])}pinch={d:d,m:m}}});
function up(e){delete pts[e.pointerId];pinch=null}
stage.addEventListener("pointerup",up);stage.addEventListener("pointercancel",up);
stage.addEventListener("wheel",function(e){e.preventDefault();var p=rel(e);zoomAt(Math.exp(-e.deltaY*0.0015),p[0],p[1])},{passive:false});
stage.addEventListener("dblclick",function(e){var p=rel(e);zoomAt(s>=MAX/2?1/s:2,p[0],p[1])});
})();`;

const FAVICON = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌍</text></svg>`;

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Map of ${R.name}: Countries, Capitals &amp; Seas | Country Facts</title>
  <meta name="description" content="A colorful political map of ${R.name} with every country, capital city and sea labeled." />
  <meta name="robots" content="noindex" />
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
    <nav class="crumbs" aria-label="Breadcrumb"><a href="../../">Country Facts</a> <span aria-hidden="true">›</span> <span>More maps</span> <span aria-hidden="true">›</span> <span>${R.name}</span></nav>
    <section class="page-card map-card">
      <h1>Political map of ${R.name}</h1>
      <p class="map-lede">${EUROPE.filter((a) => shapes.has(a)).length} ${R.members.some((a) => a === "ESH") ? "countries and territories" : "countries"}, each colored differently from its neighbors. ${R.lede}</p>
      <p class="map-hint">Tap the map to open it full size, then pinch to zoom.</p>
      <button type="button" class="map-open" id="map-open" aria-label="Open the map full size">
  ${svg}
      </button>
      <p class="map-note">Borders: <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a> (public domain). Capital cities: Natural Earth populated places. ${R.noteExtra}</p>
    </section>
  <div class="map-viewer" id="map-viewer" role="dialog" aria-modal="true" aria-label="Map of ${R.name}, full size" hidden>
    <div class="map-viewer-bar">
      <span class="map-viewer-help">Pinch to zoom, drag to move</span>
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
      <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a>.
    </p>
    <p class="footer-feedback"><a href="mailto:hello@countryfacts.app">Send feedback</a></p>
  </footer>
  <script>${VIEWER_SNIPPET}</script>
  <script>${TOGGLE_SNIPPET}</script>
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, "maps", REGION_ID), { recursive: true });
fs.writeFileSync(path.join(ROOT, "maps", REGION_ID, "index.html"), page);
console.log(`maps/${REGION_ID}/index.html written (${WIDTH}x${HEIGHT})`);
console.log("coloured:", EUROPE.filter((a) => shapes.has(a)).length, "labelled:", labelOut.filter((l) => l.kind === "country").length, "unlabelled:", unlabelled.join(","));
console.log("sizes:", labelOut.filter((l) => l.kind === "country").map((l) => `${l.a3}:${f1(l.size)}${l.angle ? "~" : ""}`).join(" "));
