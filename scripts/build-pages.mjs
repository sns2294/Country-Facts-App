// Builds one static page per sovereign country (country/<slug>/index.html),
// plus a country index, sitemap.xml and robots.txt, from data/countries.json.
// The pages are plain files, so GitHub Pages serves them as they are.
//
//   node scripts/build-pages.mjs                          # every sovereign country
//   node scripts/build-pages.mjs --only=japan,germany     # just these slugs (pilot)
//   node scripts/build-pages.mjs --check                  # exit 1 if the pages are out of date
//
// The site's address comes from site.config.json (`baseUrl`): change it there
// and rebuild to move from the github.io address to a custom domain.
// Run it after node scripts/update-data.mjs, then commit country/, sitemap.xml
// and robots.txt with the data.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const topojson = require(path.join(ROOT, "vendor/topojson-client.min.js"));
const T = require(path.join(ROOT, "country-text.js"));

// shape-rules.js is a browser script that sets window.SHAPE_RULES.
const rulesContext = { window: {} };
vm.runInNewContext(read("shape-rules.js"), rulesContext);
const SHAPE_RULES = rulesContext.window.SHAPE_RULES;

const DARK_MODE_KEY = "countryFactsApp.darkMode"; // same key as app.js
const SITE_NAME = "Country Facts";
const SPEC_ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const CHECK = process.argv.includes("--check");

// site.config.json: `baseUrl` is the site's address; `indexable` is false until
// launch, which marks every generated page noindex.
const { baseUrl: rawBase, indexable: rawIndexable } = JSON.parse(read("site.config.json"));
const BASE_URL = rawBase.replace(/\/+$/, "");
if (typeof rawIndexable !== "boolean") throw new Error('site.config.json needs "indexable": true or false');
const INDEXABLE = rawIndexable;

const esc = (t) =>
  String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hash = (...texts) => {
  const h = crypto.createHash("sha1");
  texts.forEach((t) => h.update(t));
  return h.digest("hex").slice(0, 8);
};

// ---------- data ----------

const allCountries = JSON.parse(read("data/countries.json"));
const meta = JSON.parse(read("data/meta.json"));
const byAlpha3 = new Map(allCountries.map((c) => [c.alpha3Code, c]));
const byAlpha2 = new Map(allCountries.map((c) => [c.alpha2Code, c]));

// The name shown everywhere: the app's common name ("North Korea", not the
// official "Korea (Democratic People's Republic of)").
const displayName = (c) => T.getBorderDisplayName(c.name);

const slugify = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sovereign = allCountries.filter((c) => c.sovereign).sort((a, b) => displayName(a).localeCompare(displayName(b)));
const slugOf = new Map();
{
  const seen = new Map();
  for (const c of sovereign) {
    const slug = slugify(displayName(c));
    if (!slug) throw new Error(`Empty slug for ${c.name}`);
    if (seen.has(slug)) throw new Error(`Slug "${slug}" is used by both ${seen.get(slug)} and ${c.name}`);
    seen.set(slug, c.name);
    slugOf.set(c.alpha3Code, slug);
  }
}

const unknownOnly = SPEC_ONLY.filter((s) => ![...slugOf.values()].includes(s));
if (unknownOnly.length) throw new Error(`Unknown slug(s) in --only: ${unknownOnly.join(", ")}`);
const built = sovereign.filter((c) => !SPEC_ONLY.length || SPEC_ONLY.includes(slugOf.get(c.alpha3Code)));
const hasPage = new Set(built.map((c) => c.alpha3Code));

// Land neighbours, as the app's fact card lists them: a territory's neighbours
// count for its parent too ("via <territory>"); a territory neighbour counts as
// its parent.
function borderCountries(country) {
  const chips = (country.borders || [])
    .map((code) => byAlpha3.get(code))
    .filter(Boolean)
    .map((c) => ({ code: c.alpha3Code, name: displayName(c) }));
  const listed = new Set([country.alpha3Code, ...chips.map((c) => c.code)]);
  allCountries
    .filter((t) => t.parent?.of === country.alpha3Code)
    .forEach((territory) => {
      (territory.borders || []).forEach((code) => {
        const neighbour = byAlpha3.get(code);
        if (!neighbour) return;
        const target = (neighbour.parent && byAlpha3.get(neighbour.parent.of)) || neighbour;
        if (listed.has(target.alpha3Code)) return;
        listed.add(target.alpha3Code);
        chips.push({ code: target.alpha3Code, name: displayName(target), via: territory.name.replace(/\s*\(.*\)/, "") });
      });
    });
  return chips;
}

// ---------- map ----------
// A small static map: the country in the highlight colour over its neighbours,
// framed on its main landmass. Same shape data and shape rules as the globe.

// Two levels of detail: the 50m shapes are enough for a big country's map; small
// countries (Singapore, Malta, the Maldives...) are drawn from the 10m shapes, which
// the 50m ones reduce to a few blocky points.
const padId = (id) => String(id).padStart(3, "0");

function loadShapes(topology) {
  const collection = topology.objects.countries;
  const geometries = collection.geometries;
  const features = topojson.feature(topology, collection).features;
  const alpha2ToNumeric = new Map(allCountries.filter((c) => c.numericCode).map((c) => [c.alpha2Code, c.numericCode]));
  const owner = features.map((f) => {
    if (f.id) return padId(f.id);
    const rule = SHAPE_RULES[f.properties?.name];
    if (!rule || rule.neutral) return null;
    return alpha2ToNumeric.get(rule.linkTo || rule.mergeInto) || null;
  });
  // One merged geometry per owner; shapes nobody owns stay as they are.
  const groups = new Map();
  owner.forEach((id, i) => {
    const key = id || `shape-${i}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  const shapes = new Map();
  groups.forEach((indices, key) => {
    const geometry = indices.length === 1 ? features[indices[0]].geometry : topojson.merge(topology, indices.map((i) => geometries[i]));
    shapes.set(key, { type: "MultiPolygon", coordinates: gatherAcrossDateLine(polygonsOf(geometry).map((poly) => poly.map(unwrapRing))) });
  });
  return shapes;
}
const shapes = loadShapes(JSON.parse(read("data/countries-50m.json")));
const shapes10m = loadShapes(JSON.parse(read("data/countries-10m.json")));
// A country whose framed area spans less than this many degrees uses the 10m shapes.
const DETAIL_BELOW_DEGREES = 12;

function polygonsOf(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

// The shape data cuts nothing at the date line: a ring that crosses it (Russia's
// Chukotka, Fiji, Kiribati) jumps from lon 180 to -180, which draws as a stripe
// across the whole map. Make such rings continuous (longitudes past 180), and
// draw a second copy one world over so both sides of the line show.
function unwrapRing(ring) {
  let shift = 0;
  return ring.map(([lon, lat], i) => {
    if (i > 0) {
      const jump = lon - ring[i - 1][0];
      if (jump > 180) shift -= 360;
      else if (jump < -180) shift += 360;
    }
    return [lon + shift, lat];
  });
}

// Archipelagos that straddle the line (Kiribati, Fiji): shift each polygon by a
// whole world where needed so the country sits together around its largest island.
function gatherAcrossDateLine(polys) {
  const boxes = polys.map((poly) => ringBox(poly[0]));
  const area = (b) => (b[2] - b[0]) * (b[3] - b[1]);
  const ref = boxes.reduce((best, b) => (area(b) > area(best) ? b : best), boxes[0]);
  const refLon = (ref[0] + ref[2]) / 2;
  return polys.map((poly, i) => {
    const lon = (boxes[i][0] + boxes[i][2]) / 2;
    const shift = lon - refLon > 180 ? -360 : lon - refLon < -180 ? 360 : 0;
    return shift ? poly.map((ring) => ring.map(([x, y]) => [x + shift, y])) : poly;
  });
}

function polygonsWithCopies(geometry) {
  const out = [];
  for (const poly of polygonsOf(geometry)) {
    out.push(poly);
    const [x0, , x1] = ringBox(poly[0]);
    if (x1 > 180) out.push(poly.map((ring) => ring.map(([lon, lat]) => [lon - 360, lat])));
    if (x0 < -180) out.push(poly.map((ring) => ring.map(([lon, lat]) => [lon + 360, lat])));
  }
  return out;
}
function ringBox(ring) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of ring) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}
const mergeBox = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const boxArea = ([x0, y0, x1, y1]) => (x1 - x0) * (y1 - y0);
const intersects = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

// Frame on the polygons that make up the main landmass: big enough compared
// with the largest one and not far away from it (so Alaska, Hawaii or distant
// islands don't stretch the view).
function frameBox(geometry) {
  const polys = polygonsOf(geometry).map((p) => ({ box: ringBox(p[0]) }));
  const largest = polys.reduce((a, b) => (boxArea(b.box) > boxArea(a.box) ? b : a));
  const lc = [(largest.box[0] + largest.box[2]) / 2, (largest.box[1] + largest.box[3]) / 2];
  // Specks of islands only group with their near neighbours; a big landmass reaches further.
  const largestSpan = Math.max(largest.box[2] - largest.box[0], largest.box[3] - largest.box[1]);
  const reachX = Math.min(60, Math.max(10, largestSpan * 4));
  const reachY = Math.min(40, Math.max(10, largestSpan * 4));
  const keep = polys.filter(({ box }) => {
    const c = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    return boxArea(box) >= boxArea(largest.box) * 0.03 && Math.abs(c[0] - lc[0]) < reachX && Math.abs(c[1] - lc[1]) < reachY;
  });
  return keep.reduce(
    (b, { box }) => [Math.min(b[0], box[0]), Math.min(b[1], box[1]), Math.max(b[2], box[2]), Math.max(b[3], box[3])],
    [Infinity, Infinity, -Infinity, -Infinity]
  );
}

// Sutherland–Hodgman: cut a ring to the visible rectangle so the page doesn't
// carry the outline of all of Russia or China to draw a corner of it.
function clipRing(ring, [x0, y0, x1, y1]) {
  const edges = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]],
  ];
  let out = ring.slice(0, -1);
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    input.forEach((cur, i) => {
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cross(prev, cur));
      }
    });
    if (!out.length) break;
  }
  return out;
}

// ---------- locator inset ----------
// A small world/continent map in a corner of the close-up, with the country
// marked, so a small country can be placed. Every page shares one world outline
// (country/world-land.svg, referenced with <use>); the inset is a crop of it.
// World units: x = (lon + 180) * K, y = (90 - lat) * K. K = 4 is a quarter of a
// degree per unit: coarse, but the inset is only a couple of hundred pixels wide.
const K = 4;
const wx = (lon) => Math.round((lon + 180) * K);
const wy = (lat) => Math.round((90 - lat) * K);

// Douglas–Peucker: drop points that sit within `eps` units of the line between their neighbours.
function simplify(points, eps) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points.at(-1);
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const dist = Math.abs((by - ay) * points[i][0] - (bx - ax) * points[i][1] + bx * ay - by * ax) / len;
    if (dist > far) [far, index] = [dist, i];
  }
  if (far <= eps) return [points[0], points.at(-1)];
  return [...simplify(points.slice(0, index + 1), eps).slice(0, -1), ...simplify(points.slice(index), eps)];
}

// Thin a closed ring of points to a tolerance `eps`: split it at the point farthest
// from the start and simplify the two halves, so the ring's seam isn't pinned.
function simplifyRing(pts, eps) {
  if (pts.length < 6) return pts;
  let mid = 1;
  pts.forEach((q, i) => {
    if (Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) > Math.hypot(pts[mid][0] - pts[0][0], pts[mid][1] - pts[0][1])) mid = i;
  });
  return [...simplify(pts.slice(0, mid + 1), eps).slice(0, -1), ...simplify(pts.slice(mid).concat([pts[0]]), eps).slice(0, -1)];
}

function worldPath(geometry, offset = 0, fine = false) {
  const parts = [];
  for (const poly of polygonsWithCopies(geometry)) {
    for (const ring of poly) {
      const [x0, y0, x1, y1] = ringBox(ring);
      if (!fine && x1 - x0 < 0.8 && y1 - y0 < 0.8) continue; // specks
      // A ring starts and ends on the same point, so split it at the point farthest
      // from the start and simplify the two halves.
      // `fine` (the highlighted country) keeps a tenth of a unit and nearly every point,
      // so a mid-size country keeps its real outline; the shared world outline is coarser.
      const r1 = (n) => (fine ? Math.round(n * 10) / 10 : Math.round(n));
      const raw = ring.map(([lon, lat]) => [r1((lon + 180) * K), r1((90 - lat) * K)]);
      const eps = fine ? 0.08 : 0.7;
      let mid = 1;
      raw.forEach((q, i) => {
        if (Math.hypot(q[0] - raw[0][0], q[1] - raw[0][1]) > Math.hypot(raw[mid][0] - raw[0][0], raw[mid][1] - raw[0][1])) mid = i;
      });
      const pts = [...simplify(raw.slice(0, mid + 1), eps).slice(0, -1), ...simplify(raw.slice(mid), eps)];
      if (pts.length < (fine ? 3 : 4)) continue;
      parts.push(`M${pts.map(([x, y]) => `${x + offset} ${y}`).join("L")}Z`);
    }
  }
  return parts.join("");
}

function worldLandSvg() {
  const d = [];
  shapes.forEach((geometry, key) => {
    if (key === "010") return; // Antarctica
    d.push(worldPath(geometry));
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${360 * K} ${180 * K}"><path id="land" d="${d.join("")}"/></svg>\n`;
}

// Crops, in degrees [west, east, south, north]. East can pass 180 (Oceania) because the
// outline is drawn a second time one world to the right.
const INSET_VIEWS = {
  Europe: [-25, 45, 34, 72],
  Africa: [-20, 66, -37, 38], // east to 66 so Seychelles and Mauritius sit inside
  Asia: [20, 150, -12, 60],
  Americas: [-170, -30, -57, 75],
  Oceania: [105, 235, -50, 25],
  World: [-180, 180, -58, 84],
};

// Where the inset goes: the first corner whose rectangle holds no point of the
// country (the close-up is 800 wide), shrinking the inset if every corner is taken.
function placeInset(points, aspect, height) {
  const margin = 14;
  let best = null;
  for (const width of [250, 210, 170]) {
    const h = Math.min(Math.max(width / aspect, 90), 175);
    const corners = [
      [800 - width - margin, height - h - margin],
      [800 - width - margin, margin],
      [margin, height - h - margin],
      [margin, margin],
    ];
    for (const [x, y] of corners) {
      const inside = points.filter(([px, py]) => px > x - 8 && px < x + width + 8 && py > y - 8 && py < y + h + 8).length;
      if (!best || inside < best.inside) best = { x, y, width, h, inside };
      if (!inside) return best;
    }
  }
  return best;
}

function insetMarkup(country, target, [fx0, fy0, fx1, fy1], points, mainHeight, full = false) {
  const region = INSET_VIEWS[country.region] ? country.region : "World";
  let name = region;
  let [vw0, vw1, vs, vn] = INSET_VIEWS[name];
  // The country's centre, shifted to the far side of the date line when the view wraps.
  let cLon = (fx0 + fx1) / 2;
  const cLat = (fy0 + fy1) / 2;
  const span = Math.max(fx1 - fx0, fy1 - fy0);
  const inView = () => {
    let lon = cLon;
    if (vw1 > 180 && lon < vw0) lon += 360;
    return lon >= vw0 && lon <= vw1 && cLat >= vs && cLat <= vn && span < (vw1 - vw0) * 0.5;
  };
  if (!inView()) {
    name = "World";
    [vw0, vw1, vs, vn] = INSET_VIEWS.World;
  }
  const lon = vw1 > 180 && cLon < vw0 ? cLon + 360 : cLon;
  const aspect = (vw1 - vw0) / (vn - vs);
  const pos = full ? { x: 0, y: 0, width: 800, h: 800 / aspect } : placeInset(points, aspect, mainHeight);
  const vb = `${(vw0 + 180) * K} ${(90 - vn) * K} ${(vw1 - vw0) * K} ${(vn - vs) * K}`;
  const wrap = vw1 > 180;
  const own = target ? worldPath(target, 0, true) : "";
  const ownWrapped = target && wrap ? worldPath(target, 360 * K, true) : "";
  const viewW = vw1 - vw0;
  // The real shape is always drawn. Only a country too small to see at this size
  // also gets a thin open ring, so the eye can find it.
  const pxPerUnit = pos.width / (viewW * K);
  // Judged by the largest island (a scatter of specks is "too small" even if it spans a lot of sea).
  const biggestDeg = target
    ? polygonsOf(target).reduce((m, poly) => {
        const [x0, y0, x1, y1] = ringBox(poly[0]);
        return Math.max(m, x1 - x0, y1 - y0);
      }, 0)
    : 0;
  const shapePx = biggestDeg * K * pxPerUnit;
  const groupPx = span * K * pxPerUnit;
  const ring =
    shapePx < 9
      ? `<circle class="inset-ring" cx="${wx(lon)}" cy="${wy(cLat)}" r="${Math.round((Math.max(groupPx / 2 + 5, 7) / pxPerUnit) * 10) / 10}"/>`
      : "";
  const land = `<use href="../world-land.svg#land" class="inset-land"/>${wrap ? `<use href="../world-land.svg#land" class="inset-land" x="${360 * K}"/>` : ""}`;
  return `<svg class="map-inset" x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${Math.round(pos.h)}" viewBox="${vb}" preserveAspectRatio="xMidYMid slice">
<rect x="0" y="0" width="${720 * K}" height="${180 * K}" class="map-sea"/>
${land}
<path class="inset-country" d="${own}${ownWrapped}"/>
${ring}
</svg>
${full ? "" : `<rect class="map-inset-frame" x="${pos.x}" y="${pos.y}" width="${pos.width}" height="${Math.round(pos.h)}"/>`}`;
}

// Countries missing from the map data (too small for it): a hand-set position,
// shown as a ring on a regional map in place of the close-up. Keyed by alpha2.
const MANUAL_LOCATIONS = {}; // none needed while the 10m shapes cover every country

// The regional map at full size with a ring on the country, for places a close-up
// can't show: too small for the map data, or islands only a few pixels wide.
function locatorOnly(country, box, target = null) {
  const inner = insetMarkup(country, target, box, [], 0, true);
  const h = Math.round(inner.match(/height="(\d+)"/)[1]);
  return `<svg class="country-map" viewBox="0 0 800 ${h}" role="img" aria-label="Map showing the location of ${esc(displayName(country))}" preserveAspectRatio="xMidYMid slice">\n${inner}\n</svg>`;
}

function buildMap(country) {
  const key = padId(country.numericCode);
  let set = shapes;
  let target = shapes.get(key);
  const fine = shapes10m.get(key);
  if (fine) {
    const [a, b, c, d] = frameBox(fine);
    if (Math.max(c - a, d - b) < DETAIL_BELOW_DEGREES) {
      set = shapes10m;
      target = fine;
    }
  }
  if (!target) {
    const at = MANUAL_LOCATIONS[country.alpha2Code];
    return at ? locatorOnly(country, [at[0], at[1], at[0], at[1]]) : null;
  }
  const [fx0, fy0, fx1, fy1] = frameBox(target);
  const midLat = (fy0 + fy1) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  // Pad the frame, give tiny countries a minimum span, and fit a 16:10 box.
  let w = Math.max((fx1 - fx0) * 1.5, 4) * kx;
  let h = Math.max((fy1 - fy0) * 1.5, 4);
  if (w / h > 1.6) h = w / 1.6;
  else w = h * 1.6;
  const cx = ((fx0 + fx1) / 2) * kx;
  const cy = (fy0 + fy1) / 2;
  const view = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
  const unit = 800 / w; // projected degrees -> SVG units
  const biggest = polygonsOf(target).reduce((m, poly) => {
    const [x0, y0, x1, y1] = ringBox(poly[0]);
    return Math.max(m, (x1 - x0) * kx * unit, (y1 - y0) * unit);
  }, 0);
  // The ring marks the whole country, not just the cluster the close-up would frame
  // (Kiribati's Gilbert, Phoenix and Line islands are thousands of km apart).
  if (biggest < 20) return locatorOnly(country, polygonsOf(target).map((p) => ringBox(p[0])).reduce(mergeBox), target);
  const px = (lon) => (lon * kx - view.x0) * unit;
  const py = (lat) => (view.y1 - lat) * unit;
  const lonLatView = [view.x0 / kx, view.y0, view.x1 / kx, view.y1];
  const clipBox = [
    view.x0 / kx - (w / kx) * 0.05,
    view.y0 - h * 0.05,
    view.x1 / kx + (w / kx) * 0.05,
    view.y1 + h * 0.05,
  ];

  const num = (n) => Math.round(n * 10) / 10;
  function pathFor(geometry, collect) {
    const parts = [];
    for (const poly of polygonsWithCopies(geometry)) {
      for (const ring of poly) {
        if (!intersects(ringBox(ring), lonLatView)) continue;
        const clipped = clipRing(ring, clipBox);
        if (clipped.length < 3) continue;
        // Specks under about a pixel can't be seen; don't carry them.
        const [rx0, ry0, rx1, ry1] = ringBox(clipped);
        if (!collect && Math.max((rx1 - rx0) * kx * unit, (ry1 - ry0) * unit) < 1.5) continue;
        // Points closer than half a pixel (a quarter for the highlighted country) are
        // invisible; the 10m shapes carry many of them.
        const pts = simplifyRing(clipped.map(([lon, lat]) => [px(lon), py(lat)]), collect ? 0.25 : 0.6);
        let d = "";
        let last = "";
        pts.forEach(([x, y], i) => {
          const pt = `${num(x)} ${num(y)}`;
          if (pt === last) return;
          if (collect) collect.push([x, y]);
          d += `${i === 0 ? "M" : "L"}${pt}`;
          last = pt;
        });
        if (d.includes("L")) parts.push(`${d}Z`);
      }
    }
    return parts.join("");
  }

  const targetKey = padId(country.numericCode);
  const others = [];
  set.forEach((geometry, key) => {
    if (key === targetKey) return;
    const d = pathFor(geometry);
    if (d) others.push(d);
  });
  const points = [];
  const own = pathFor(target, points);
  const height = Math.round(800 / 1.6);
  const inset = insetMarkup(country, target, [fx0, fy0, fx1, fy1], points, height);
  return `<svg class="country-map" viewBox="0 0 800 ${height}" role="img" aria-label="Map showing the location of ${esc(displayName(country))}" preserveAspectRatio="xMidYMid slice">
<rect width="800" height="${height}" class="map-sea"/>
<path class="map-land" d="${others.join("")}"/>
<path class="map-country" d="${own}"/>
${inset}
</svg>`;
}

// ---------- text ----------

function populationWords(n) {
  if (typeof n !== "number") return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2).replace(/\.?0+$/, "")} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")} million`;
  return n.toLocaleString("en-US");
}

const listWords = (items) =>
  items.length > 2 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items.join(" and ");

function metaDescription(country, name, chips) {
  const lead = [];
  if (country.capital) lead.push(`capital ${country.capital}`);
  const pop = populationWords(country.population);
  if (pop) lead.push(`population ${pop}`);
  let text = `${name} facts: ${lead.join(", ") || "key facts"}`;
  const optional = [];
  if (country.languages?.length) {
    const langs = country.languages.map((l) => l.name);
    optional.push(`${langs.length > 1 ? "languages" : "language"} ${listWords(langs.slice(0, 4))}`);
  }
  // Borders are left out entirely for a country that has none.
  if (chips.length) {
    const names = chips.map((c) => c.name);
    optional.push(names.length > 4 ? `borders ${names.slice(0, 4).join(", ")} and ${names.length - 4} more` : `borders ${listWords(names)}`);
  }
  if (typeof country.area === "number") optional.push(`area ${country.area.toLocaleString("en-US")} km²`);
  for (const piece of optional) {
    if ((text + `, ${piece}.`).length > 150) continue;
    text += `, ${piece}`;
  }
  text += ".";
  for (const tail of [" Flag, map and quiz.", " Flag and map."]) {
    if ((text + tail).length <= 160) {
      text += tail;
      break;
    }
  }
  return text;
}

function introText(country, name) {
  let text = T.buildOverview({ ...country, name });
  const pop = populationWords(country.population);
  if (country.capital) text += ` Its capital is ${country.capital}.`;
  if (pop) text += ` About ${pop} people live there${country.populationYear ? ` (${country.populationYear})` : ""}.`;
  return text;
}

// ---------- page ----------

const styleHash = hash(read("style.css"));
const pageCssHash = hash(read("country-page.css"));
const updatedAt = new Date(meta.updatedAt);
const updatedDay = updatedAt.toISOString().slice(0, 10);
const updatedLong = updatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

const THEME_SNIPPET = `try{var s=localStorage.getItem(${JSON.stringify(DARK_MODE_KEY)});var d=s===null?matchMedia("(prefers-color-scheme: dark)").matches:s==="true";document.documentElement.classList.toggle("dark",d)}catch(e){}`;
const TOGGLE_SNIPPET = `(function(){var b=document.getElementById("dark-mode-toggle"),i=document.getElementById("dark-mode-icon"),r=document.documentElement;function sync(){var d=r.classList.contains("dark");b.setAttribute("aria-pressed",String(d));i.textContent=d?"\\u2600\\uFE0F":"\\uD83C\\uDF19"}sync();b.addEventListener("click",function(){var d=!r.classList.contains("dark");r.classList.toggle("dark",d);try{localStorage.setItem(${JSON.stringify(DARK_MODE_KEY)},String(d))}catch(e){}sync()})})();`;

const FAVICON = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌍</text></svg>`;

const FOOTER = `<footer class="site-footer">
    <p>Data last updated: ${esc(updatedLong)}</p>
    <p class="data-credits">
      Data:
      <a href="https://countries.dev" target="_blank" rel="noopener">countries.dev</a>
      (<a href="https://www.geonames.org" target="_blank" rel="noopener">GeoNames</a>),
      <a href="https://www.cia.gov/the-world-factbook/" target="_blank" rel="noopener">CIA World Factbook</a>,
      <a href="https://data.worldbank.org" target="_blank" rel="noopener">World Bank</a>,
      <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a>,
      <a href="https://flagicons.lipis.dev" target="_blank" rel="noopener">flag-icons</a>.
    </p>
  </footer>`;

function shell({ depth, title, description, canonical, jsonLd, body }) {
  const up = "../".repeat(depth);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />${INDEXABLE ? "" : '\n  <meta name="robots" content="noindex" />'}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta name="twitter:card" content="summary" />
  <link rel="icon" href="${FAVICON}" />
  <script>${THEME_SNIPPET}</script>
  <link rel="stylesheet" href="${up}style.css?v=${styleHash}" />
  <link rel="stylesheet" href="${up}country-page.css?v=${pageCssHash}" />${
    jsonLd ? `\n  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""
  }
</head>
<body>
  <header class="app-header">
    <div class="app-header-text">
      <a class="site-title" href="${up}">${SITE_NAME}</a>
      <p class="app-subtitle">Explore countries, browse the map, and test what you know.</p>
    </div>
    <button id="dark-mode-toggle" type="button" aria-pressed="false" title="Toggle dark mode">
      <span id="dark-mode-icon" aria-hidden="true">🌙</span>
    </button>
  </header>
${body}
  ${FOOTER}
  <script>${TOGGLE_SNIPPET}</script>
</body>
</html>
`;
}

function countryPage(country) {
  const name = displayName(country);
  const slug = slugOf.get(country.alpha3Code);
  const code = country.alpha2Code.toLowerCase();
  const chips = borderCountries(country);
  const gdp = country.gdp;
  const showNative = country.nativeName && country.nativeName !== name && country.nativeName !== country.name;
  const canonical = `${BASE_URL}/country/${slug}/`;
  const title = `${name}: Capital, Population, Languages & Facts | ${SITE_NAME}`;
  const description = metaDescription(country, name, chips);

  const chipMarkup = chips
    .map((b) => {
      const label = `${esc(b.name)}${b.via ? ` <span class="chip-via">via ${esc(b.via)}</span>` : ""}`;
      return hasPage.has(b.code)
        ? `<a class="border-chip" href="../${slugOf.get(b.code)}/">${label}</a>`
        : `<span class="border-chip">${label}</span>`;
    })
    .join("");
  const bordersMarkup = chips.length
    ? `<div class="borders-section"><h2 class="stat-heading">Bordering countries</h2><div class="borders-list">${chipMarkup}</div></div>`
    : `<div class="borders-section"><h2 class="stat-heading">Bordering countries</h2><p class="no-borders">${esc(name)} has no land borders.</p></div>`;

  const stat = (label, value) => `<div class="stat"><dt>${label}</dt><dd>${value}</dd></div>`;
  const facts = [
    stat("Capital", esc(country.capital || "N/A")),
    stat("Population", `${T.formatPopulation(country.population)}${country.populationYear ? ` <span class="stat-note">(${country.populationYear})</span>` : ""}`),
    stat("Region", esc(T.formatRegion(country))),
    stat("Area", T.formatArea(country.area)),
    stat("Demonym", esc(country.demonym || "N/A")),
    stat("Languages", country.languages?.length ? esc(country.languages.map((l) => l.name).join(", ")) : "N/A"),
    stat("Form of Government", esc(T.formatGovernment(country))),
    stat("Religion", T.formatReligions(country.religions, country)),
    stat("Currency", esc(T.formatCurrencies(T.getCurrencies(country)))),
    stat("GDP", `${gdp ? T.formatGdp(gdp) : T.missingGdp(country)}${gdp ? ` <span class="stat-note">(${gdp.year})</span>` : ""}`),
  ].join("\n          ");

  const map = buildMap(country);
  const peers = built
    .filter((c) => c !== country && c.subregion && c.subregion === country.subregion)
    .slice(0, 12);
  const peersMarkup = peers.length
    ? `<section class="page-card"><h2>More in ${esc(country.subregion)}</h2><div class="borders-list">${peers
        .map((c) => `<a class="border-chip" href="../${slugOf.get(c.alpha3Code)}/">${esc(displayName(c))}</a>`)
        .join("")}</div></section>`
    : "";

  const app = `../../?country=${code}`;
  const body = `  <main class="country-page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="../../">${SITE_NAME}</a> <span aria-hidden="true">›</span> <a href="../">Countries</a> <span aria-hidden="true">›</span> <span>${esc(name)}</span></nav>
    <article class="fact-card">
      <div class="card-header">
        <img class="flag" src="../../${esc(country.flags.svg)}" alt="Flag of ${esc(name)}" width="64" height="43" />
        <div>
          <h1>${esc(name)}</h1>
          ${showNative ? `<p class="native-name">${esc(country.nativeName)}</p>` : ""}
        </div>
      </div>
      <div class="card-body">
        <p class="intro">${esc(introText(country, name))}</p>
        <dl class="stats-grid">
          ${facts}
        </dl>
        ${bordersMarkup}
      </div>
    </article>
    ${map ? `<section class="page-card"><h2>Where is ${esc(name)}?</h2>${map}</section>` : ""}
    <section class="page-card cta">
      <h2>Explore and practice</h2>
      <div class="cta-links">
        <a class="quiz-btn-primary" href="${app}&amp;view=globe">See ${esc(name)} on the globe</a>
        <a class="quiz-btn-secondary" href="${app}&amp;view=map">Flat map</a>
        <a class="quiz-btn-secondary" href="../../?section=quiz">Take a quiz</a>
      </div>
    </section>
    ${peersMarkup}
  </main>`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Country",
      name,
      ...(showNative ? { alternateName: country.nativeName } : {}),
      url: canonical,
      image: `${BASE_URL}/${country.flags.svg}`,
      description,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${BASE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Countries", item: `${BASE_URL}/country/` },
        { "@type": "ListItem", position: 3, name, item: canonical },
      ],
    },
  ];
  return shell({ depth: 2, title, description, canonical, jsonLd, body });
}

function indexPage() {
  const regions = [...new Set(built.map((c) => c.region))].sort();
  const sections = regions
    .map((region) => {
      const items = built
        .filter((c) => c.region === region)
        .map((c) => `<li><a href="${slugOf.get(c.alpha3Code)}/">${esc(displayName(c))}</a></li>`)
        .join("");
      return `<section class="page-card"><h2>${esc(region)}</h2><ul class="country-list">${items}</ul></section>`;
    })
    .join("\n    ");
  const canonical = `${BASE_URL}/country/`;
  const title = `All Countries: Facts, Capitals & Populations | ${SITE_NAME}`;
  const description = `Facts for ${built.length} countries: capital, population, languages, religion and neighbours, each with a flag and map.`;
  const body = `  <main class="country-page">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="../">${SITE_NAME}</a> <span aria-hidden="true">›</span> <span>Countries</span></nav>
    <h1 class="index-title">Countries of the world</h1>
    ${sections}
  </main>`;
  return shell({ depth: 1, title, description, canonical, body });
}

function sitemap() {
  const urls = [`${BASE_URL}/`, `${BASE_URL}/country/`, ...built.map((c) => `${BASE_URL}/country/${slugOf.get(c.alpha3Code)}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${updatedDay}</lastmod></url>`).join("\n")}
</urlset>
`;
}

// While noindex, robots.txt must not block the pages (crawlers have to fetch
// them to see the tag) and doesn't advertise the sitemap.
const robots = () => `User-agent: *\nAllow: /\n${INDEXABLE ? `\nSitemap: ${BASE_URL}/sitemap.xml\n` : ""}`;

// ---------- write ----------

let outputs_index; // index.html with its robots block updated

// index.html is hand-written, so the build only rewrites its robots block, keeping
// the whole site's indexing on the one `indexable` setting.
{
  const html = read("index.html");
  const block = /(<!-- robots:start[^>]*-->\n)[\s\S]*?(  <!-- robots:end -->)/;
  if (!block.test(html)) throw new Error("index.html is missing its <!-- robots:start --> / <!-- robots:end --> block");
  outputs_index = html.replace(block, `$1${INDEXABLE ? "" : '  <meta name="robots" content="noindex" />\n'}$2`);
}
const outputs = new Map();
outputs.set("index.html", outputs_index);
outputs.set("country/index.html", indexPage());
for (const c of built) outputs.set(`country/${slugOf.get(c.alpha3Code)}/index.html`, countryPage(c));
outputs.set("country/world-land.svg", worldLandSvg());
outputs.set("sitemap.xml", sitemap());
outputs.set("robots.txt", robots());

if (CHECK) {
  const stale = [...outputs].filter(([file, text]) => !fs.existsSync(path.join(ROOT, file)) || read(file) !== text).map(([f]) => f);
  if (stale.length) {
    console.error(`${stale.length} generated file(s) are out of date. Run: node scripts/build-pages.mjs`);
    process.exit(1);
  }
  console.log("Country pages are up to date.");
} else {
  // Remove pages for slugs no longer built (e.g. a country renamed in the data).
  const countryDir = path.join(ROOT, "country");
  if (fs.existsSync(countryDir)) {
    for (const entry of fs.readdirSync(countryDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !outputs.has(`country/${entry.name}/index.html`)) {
        fs.rmSync(path.join(countryDir, entry.name), { recursive: true });
      }
    }
  }
  for (const [file, text] of outputs) {
    fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, file), text);
  }
  console.log(`Wrote ${built.length} country pages, the country index, sitemap.xml and robots.txt (base URL ${BASE_URL}).`);
}
