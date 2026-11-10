// Gives overseas territories their own map shapes. Natural Earth draws French
// Guiana, Svalbard, Bonaire... as parts of France, Norway and the Netherlands,
// but countries.json has separate entries for them. This pulls those parts out
// into shapes of their own (named as in SHARED_NAMES below; shape-rules.js
// links each name to its countries.json entry).
//
//   node scripts/split-territories.mjs   splits data/countries-*m*.json and world-map.svg in place and
//                                        adds the parent notes to data/countries.json
//
// scripts/update-data.mjs calls splitTopology() on every fresh atlas download,
// so a data refresh keeps the split. The script is safe to run repeatedly.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// Each territory is found among its parent's parts by where the part sits
// (bounding-box centre, degrees). `box` is [minLon, maxLon, minLat, maxLat].
export const TERRITORIES = [
  { parentNumeric: "250", parent: "FR", name: "French Guiana", alpha2: "GF", numeric: "254", boxes: [[-56, -51, 2, 6]] },
  { parentNumeric: "250", parent: "FR", name: "Guadeloupe", alpha2: "GP", numeric: "312", boxes: [[-64, -60, 15.5, 17]], small: true },
  { parentNumeric: "250", parent: "FR", name: "Martinique", alpha2: "MQ", numeric: "474", boxes: [[-61.5, -60.5, 14, 15]], small: true },
  { parentNumeric: "250", parent: "FR", name: "Réunion", alpha2: "RE", numeric: "638", boxes: [[55, 56, -22, -20]], small: true },
  { parentNumeric: "250", parent: "FR", name: "Mayotte", alpha2: "YT", numeric: "175", boxes: [[44.5, 45.5, -13.5, -12]], small: true },
  // Svalbard, Bear Island and Jan Mayen (the mainland tops out near 71.2°N, 5°E or more).
  {
    parentNumeric: "578",
    parent: "NO",
    name: "Svalbard and Jan Mayen",
    alpha2: "SJ",
    numeric: "744",
    boxes: [
      [-180, 180, 74, 90],
      [-12, 0, 70, 72],
    ],
  },
  // Bonaire, Sint Eustatius and Saba (Aruba, Curaçao and Sint Maarten already have shapes).
  {
    parentNumeric: "528",
    parent: "NL",
    name: "Bonaire, Sint Eustatius and Saba",
    alpha2: "BQ",
    numeric: "535",
    boxes: [[-70, -62, 11, 19]],
    small: true,
  },
];

// Shapes that get split out of their parent only so shape-rules.js can merge them into the country
// that internationally recognized borders give them to (no countries.json entry, no fact card).
// Natural Earth draws Crimea inside Russia; the site shows it as part of Ukraine, the same way
// "N. Cyprus" is merged into Cyprus (see shape-rules.js: `Crimea: { mergeInto: "UA" }`).
export const SHAPE_SPLITS = [
  { parentNumeric: "643", parent: "RU", name: "Crimea", boxes: [[32.3, 36.9, 44.2, 46.3]] },
];

// Shapes that are not a polygon of their own in Natural Earth but part of one country's outline, cut off along a
// meridian: everything of the parent at or east of `lon` becomes the shape `name` (no countries.json entry, no fact
// card), which shape-rules.js merges into the country the UN recognizes as its owner.
// The Golan Heights: Natural Earth puts the Israeli-held part in Israel; internationally it is Syrian territory (see
// shape-rules.js: `"Golan Heights": { mergeInto: "SY" }`). 35.64°E runs along the Jordan River and the east shore of the
// Sea of Galilee, so everything east of it (Golan, Mount Hermon) is cut off, and nothing of Israel proper is.
export const MERIDIAN_CUTS = [
  { parentNumeric: "376", parent: "IL", name: "Golan Heights", lon: 35.64 },
];

// Western Sahara. Natural Earth's "Morocco" outline also encloses the Moroccan-administered part of Western Sahara, and its
// separate "W. Sahara" shape is only the strip east of the berm, so Morocco's shape covered most of Western Sahara. The
// recognized boundary is the 27°40'N parallel (the Tarfaya border): everything of the parent south of `lat` is cut off and
// joined to the shape `into`, so Western Sahara is one territory of its own (the same boundary scripts/build-maps.mjs uses).
// The cut passes through the existing vertex of the outline nearest `lat` (within 0.05°), so no sliver is left.
export const PARALLEL_CUTS = [
  { parentNumeric: "504", parent: "MA", intoNumeric: "732", into: "EH", name: "Western Sahara", lat: 27 + 40 / 60 },
];


// ---- Disputed areas ----
// The site's rule: internationally recognized borders, and areas whose ownership the UN has not settled are given to no
// country (drawn neutral: hatched on the flat map and country pages, flat gray on the globe, never clickable). Natural
// Earth puts every such area inside the country that administers it, so they are cut out of their owners here, in the
// data every surface reads. (The regional and density maps draw them from map-data/disputed.json instead and read
// data/countries-10m-uncut.json, the 10m atlas before these cuts, so their pages stay as they were.)
//
// Whole polygons of the owner (islands): split out like the territories above and named so shape-rules.js can mark them
// neutral. `optional` shapes are only in the atlases that draw them (the 10m atlas has Senkaku, Dokdo, the Paracels and
// Matthew Island; the 50m ones do not).
export const NEUTRAL_SPLITS = [
  { parentNumeric: "643", parent: "RU", name: "Southern Kuril Islands", boxes: [[145.3, 148.9, 43.2, 45.8]], neutral: true }, // administered by Russia, claimed by Japan
  { parentNumeric: "156", parent: "CN", name: "Paracel Islands", boxes: [[110.5, 113, 15.5, 17.2]], neutral: true, optional: true },
  { parentNumeric: "392", parent: "JP", name: "Senkaku Islands", boxes: [[123, 124.6, 25.4, 26.1]], neutral: true, optional: true },
  { parentNumeric: "410", parent: "KR", name: "Dokdo", boxes: [[131.7, 132, 37.1, 37.4]], neutral: true, optional: true },
  { parentNumeric: "540", parent: "NC", name: "Matthew Island", boxes: [[171, 172.3, -22.6, -22]], neutral: true, optional: true }, // administered by France, claimed by Vanuatu
];

// Kashmir runs through the middle of three countries' outlines, so it is cut out with a polygon difference: the area of
// map-data/disputed.json's `group` (extract-disputed.mjs) is taken out of each owner and becomes one neutral shape `name`
// (replacing the old Siachen Glacier shape, which is part of it). Pieces the difference leaves that are smaller than
// `sliver` square degrees are not land of their own but gaps between two drawings of one border, so they join the neutral shape.
export const DISPUTED_CUTS = [
  { name: "Kashmir", group: "kashmir", owners: [{ numeric: "356", alpha2: "IN" }, { numeric: "586", alpha2: "PK" }, { numeric: "156", alpha2: "CN" }], absorb: "Siachen Glacier", sliver: 0.01 },
];

const nodeRequire = createRequire(import.meta.url);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
let clippingLib = null;
const clipping = () => (clippingLib ??= nodeRequire(path.join(SCRIPT_DIR, "../vendor/polygon-clipping.umd.min.js")));
let topojsonLib = null;
const topojsonClient = () => (topojsonLib ??= nodeRequire(path.join(SCRIPT_DIR, "../vendor/topojson-client.min.js")));
const disputedAreas = (group) => JSON.parse(fs.readFileSync(path.join(SCRIPT_DIR, "../map-data/disputed.json"), "utf8")).filter((a) => a.group === group);
const ringArea = (ring) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; return a / 2; };
const polyBox = (poly) => { const xs = poly[0].map((p) => p[0]), ys = poly[0].map((p) => p[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
const boxesOverlap = (a, b) => a[0] <= b[1] && b[0] <= a[1] && a[2] <= b[3] && b[2] <= a[3];

// The core of a disputed cut, on polygons in degrees ([[outer ring, ...holes]]; rings closed). `owners` maps a key to its
// polygons, `absorbed` is extra land that is part of the area (the Siachen shape). Returns the owners without the area
// and the neutral shape.
function cutDisputed(owners, absorbed, cut) {
  const pc = clipping();
  const area = disputedAreas(cut.group).flatMap((a) => a.p);
  const U = pc.union(...area.map((poly) => [poly]));
  const uBox = [Math.min(...U.map((p) => polyBox(p)[0])), Math.max(...U.map((p) => polyBox(p)[1])), Math.min(...U.map((p) => polyBox(p)[2])), Math.max(...U.map((p) => polyBox(p)[3]))];
  const land = pc.union(...[...owners.values()].flat().map((poly) => [poly]), ...absorbed.map((poly) => [poly]));
  const slivers = [];
  const kept = new Map();
  for (const [key, polys] of owners) {
    const out = [];
    for (const poly of polys) {
      if (!boxesOverlap(polyBox(poly), uBox) || !pc.intersection([poly], U).length) { out.push(poly); continue; }
      for (const piece of pc.difference([poly], U)) (Math.abs(ringArea(piece[0])) >= cut.sliver ? out : slivers).push(piece);
    }
    kept.set(key, out);
  }
  // Holes are dropped: the owners' simplified outlines leave tiny gaps inside the area, which belong to it
  const neutral = pc.union(pc.intersection(U, land), ...slivers.map((p) => [p])).map((poly) => [poly[0]]);
  return { kept, neutral, slivers: slivers.length };
}

// The note shown on a territory's fact card, the country it belongs to (alpha3),
// a noun phrase for its overview sentence and the possessive used where its
// figures are folded into the parent's ("Included in France's figures").
// Stored as `parent` in countries.json; the app also uses it to list
// the territory's land neighbours "via" the parent. Covers the shapes split off
// here plus Saint Martin / Sint Maarten, which already have shapes.
export const TERRITORY_PARENTS = {
  GF: { of: "FRA", note: "Overseas region of France", phrase: "an overseas region of France", figures: "France's" },
  GP: { of: "FRA", note: "Overseas region of France", phrase: "an overseas region of France", figures: "France's" },
  MQ: { of: "FRA", note: "Overseas region of France", phrase: "an overseas region of France", figures: "France's" },
  RE: { of: "FRA", note: "Overseas region of France", phrase: "an overseas region of France", figures: "France's" },
  YT: { of: "FRA", note: "Overseas region of France", phrase: "an overseas region of France", figures: "France's" },
  MF: { of: "FRA", note: "Overseas collectivity of France", phrase: "an overseas collectivity of France", figures: "France's" },
  SJ: { of: "NOR", note: "Territory of Norway", phrase: "a territory of Norway", figures: "Norway's" },
  BQ: { of: "NLD", note: "Special municipalities of the Netherlands", phrase: "a group of special municipalities of the Netherlands", figures: "the Netherlands'" },
  SX: { of: "NLD", note: "Constituent country of the Netherlands", phrase: "a constituent country of the Netherlands", figures: "the Netherlands'" },
};

const inBoxes = (boxes, lon, lat) => boxes.some(([x0, x1, y0, y1]) => lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1);

// ---- TopoJSON ----

function decodeArcs(topology) {
  const [sx, sy] = topology.transform.scale;
  const [tx, ty] = topology.transform.translate;
  return topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * sx + tx, y * sy + ty];
    });
  });
}

function polygonCentre(polygon, arcs) {
  const pts = polygon[0].flatMap((i) => (i < 0 ? arcs[~i] : arcs[i]));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

// Cuts a polygon's outline along a meridian without breaking the topology: arcs that cross the line are split at it (every
// geometry using an arc is updated), and one new arc runs along the cut, shared by the two pieces in opposite directions.
function cutTopologyByMeridian(topology, cut) {
  const geometries = topology.objects.countries.geometries;
  if (geometries.some((g) => g.properties?.name === cut.name)) return false;
  const parent = geometries.find((g) => g.id === cut.parentNumeric);
  if (!parent) throw new Error(`Parent shape ${cut.parentNumeric} for ${cut.name} not found`);
  if (parent.type !== "Polygon" || parent.arcs.length !== 1) throw new Error(`${parent.properties.name} is not a single-ring polygon`);
  const [sx] = topology.transform.scale;
  const [tx] = topology.transform.translate;
  const CUT = Math.round((cut.lon - tx) / sx); // the cut as a grid column, so no rounding doubt about which side a point is on
  const decode = (k) => { let x = 0, y = 0; return topology.arcs[k].map(([dx, dy]) => [(x += dx), (y += dy)]); };
  const encode = (pts) => pts.map(([x, y], i) => (i ? [x - pts[i - 1][0], y - pts[i - 1][1]] : [x, y]));
  const eachGeometry = (fn) => {
    const walk = (g) => { if (g.type === "GeometryCollection") g.geometries.forEach(walk); else fn(g); };
    Object.values(topology.objects).forEach(walk);
  };
  const replaceArcs = (nested, k, extra) => nested.flatMap((e) => {
    if (Array.isArray(e)) return [replaceArcs(e, k, extra)];
    if (e === k) return [k, extra];
    if (e === ~k) return [~extra, ~k];
    return [e];
  });
  // 1) split every arc of the ring that crosses the line, at the crossing
  for (let guard = 0; guard < 50; guard++) {
    let split = null;
    for (const e of parent.arcs[0]) {
      const k = e < 0 ? ~e : e, pts = decode(k);
      for (let j = 0; j + 1 < pts.length && !split; j++) {
        if (pts[j][0] < CUT !== pts[j + 1][0] < CUT && pts[j][0] !== CUT && pts[j + 1][0] !== CUT) {
          const t = (CUT - pts[j][0]) / (pts[j + 1][0] - pts[j][0]);
          split = { k, j, pts, X: [CUT, Math.round(pts[j][1] + t * (pts[j + 1][1] - pts[j][1]))] };
        }
      }
      if (split) break;
    }
    if (!split) break;
    const { k, j, pts, X } = split, extra = topology.arcs.length;
    topology.arcs[k] = encode([...pts.slice(0, j + 1), X]);
    topology.arcs.push(encode([X, ...pts.slice(j + 1)]));
    eachGeometry((g) => { if (g.arcs) g.arcs = replaceArcs(g.arcs, k, extra); });
  }
  // 2) which pieces of the ring are east of the line
  const ring = parent.arcs[0];
  const orient = (e) => (e < 0 ? decode(~e).reverse() : decode(e));
  const east = ring.map((e) => {
    const off = orient(e).filter(([x]) => x !== CUT);
    return off.length > 0 && off.every(([x]) => x > CUT);
  });
  const n = ring.length;
  const starts = east.map((v, i) => v && !east[(i + n - 1) % n]);
  if (starts.filter(Boolean).length !== 1 || east.every(Boolean) || !east.some(Boolean)) throw new Error(`${cut.name}: the cut does not split ${parent.properties.name}'s outline in two`);
  const a = starts.indexOf(true);
  let b = a;
  while (east[(b + 1) % n]) b = (b + 1) % n;
  const inside = [], outside = [];
  for (let i = a; ; i = (i + 1) % n) { inside.push(ring[i]); if (i === b) break; }
  for (let i = (b + 1) % n; i !== a; i = (i + 1) % n) outside.push(ring[i]);
  const pStart = orient(inside[0])[0], pEnd = orient(inside.at(-1)).at(-1);
  // 3) the new arc along the cut: from where the east piece ends back to where it starts
  const c = topology.arcs.length;
  topology.arcs.push(encode([pEnd, pStart]));
  parent.arcs = [[...outside, ~c]];
  geometries.push({ type: "MultiPolygon", arcs: [[[...inside, c]]], properties: { name: cut.name } });
  return true;
}


// Cuts everything of a polygon's outline south of a parallel and merges it into another shape, without breaking the topology.
// Same idea as cutTopologyByMeridian: arcs that cross the line are split at it (every geometry using an arc is updated), one
// new arc runs along the cut, and the cut-off piece is joined to the `into` shape by dropping the arc the two share.
function cutTopologyByParallel(topology, cut) {
  const geometries = topology.objects.countries.geometries;
  const parent = geometries.find((g) => g.id === cut.parentNumeric);
  const into = geometries.find((g) => g.id === cut.intoNumeric);
  if (!parent || !into) throw new Error(`Shapes ${cut.parentNumeric} / ${cut.intoNumeric} for ${cut.name} not found`);
  if (parent.type !== "Polygon" || parent.arcs.length !== 1) throw new Error(`${parent.properties.name} is not a single-ring polygon`);
  if (into.type !== "Polygon" || into.arcs.length !== 1) throw new Error(`${into.properties.name} is not a single-ring polygon`);
  const [sy] = [topology.transform.scale[1]];
  const ty = topology.transform.translate[1];
  const decode = (k) => { let x = 0, y = 0; return topology.arcs[k].map(([dx, dy]) => [(x += dx), (y += dy)]); };
  const encode = (pts) => pts.map(([x, y], i) => (i ? [x - pts[i - 1][0], y - pts[i - 1][1]] : [x, y]));
  // the grid row of the outline's own junction (an arc's end point) nearest the cut latitude, not a coastline vertex
  const target = (cut.lat - ty) / sy;
  let CUT = null;
  for (const e of parent.arcs[0]) for (const [, y] of (([f, ...r]) => [f, r.at(-1) ?? f])(decode(e < 0 ? ~e : e))) if (Math.abs(y - target) * sy <= 0.05 && (CUT === null || Math.abs(y - target) < Math.abs(CUT - target))) CUT = y;
  if (CUT === null) throw new Error(`${cut.name}: no vertex of ${parent.properties.name}'s outline near ${cut.lat}°N`);
  if (!parent.arcs[0].some((e) => decode(e < 0 ? ~e : e).some(([, y]) => y < CUT))) return false; // already cut
  const eachGeometry = (fn) => {
    const walk = (g) => { if (g.type === "GeometryCollection") g.geometries.forEach(walk); else fn(g); };
    Object.values(topology.objects).forEach(walk);
  };
  const replaceArcs = (nested, k, extra) => nested.flatMap((e) => {
    if (Array.isArray(e)) return [replaceArcs(e, k, extra)];
    if (e === k) return [k, extra];
    if (e === ~k) return [~extra, ~k];
    return [e];
  });
  // 1) split every arc of the ring that crosses the line, at the crossing
  for (let guard = 0; guard < 50; guard++) {
    let split = null;
    for (const e of parent.arcs[0]) {
      const k = e < 0 ? ~e : e, pts = decode(k);
      for (let j = 0; j + 1 < pts.length && !split; j++) {
        if (pts[j][1] < CUT !== pts[j + 1][1] < CUT && pts[j][1] !== CUT && pts[j + 1][1] !== CUT) {
          const t = (CUT - pts[j][1]) / (pts[j + 1][1] - pts[j][1]);
          split = { k, j, pts, X: [Math.round(pts[j][0] + t * (pts[j + 1][0] - pts[j][0])), CUT] };
        }
      }
      if (split) break;
    }
    if (!split) break;
    const { k, j, pts, X } = split, extra = topology.arcs.length;
    topology.arcs[k] = encode([...pts.slice(0, j + 1), X]);
    topology.arcs.push(encode([X, ...pts.slice(j + 1)]));
    eachGeometry((g) => { if (g.arcs) g.arcs = replaceArcs(g.arcs, k, extra); });
  }
  // 2) which pieces of the ring are south of the line
  const ring = parent.arcs[0];
  const orient = (e) => (e < 0 ? decode(~e).reverse() : decode(e));
  const south = ring.map((e) => {
    const off = orient(e).filter(([, y]) => y !== CUT);
    return off.length > 0 && off.every(([, y]) => y < CUT);
  });
  const n = ring.length;
  const starts = south.map((v, i) => v && !south[(i + n - 1) % n]);
  if (starts.filter(Boolean).length !== 1 || south.every(Boolean) || !south.some(Boolean)) throw new Error(`${cut.name}: the cut does not split ${parent.properties.name}'s outline in two`);
  const a = starts.indexOf(true);
  let b = a;
  while (south[(b + 1) % n]) b = (b + 1) % n;
  const inside = [], outside = [];
  for (let i = a; ; i = (i + 1) % n) { inside.push(ring[i]); if (i === b) break; }
  for (let i = (b + 1) % n; i !== a; i = (i + 1) % n) outside.push(ring[i]);
  const pStart = orient(inside[0])[0], pEnd = orient(inside.at(-1)).at(-1);
  // 3) the new arc along the cut: from where the south piece ends back to where it starts
  const c = topology.arcs.length;
  topology.arcs.push(encode([pEnd, pStart]));
  parent.arcs = [[...outside, ~c]];
  // 4) join the south piece to `into`: the two rings share an arc, run in opposite directions; drop it from both
  const piece = [...inside, c];
  const target2 = into.arcs[0];
  const shared = target2.find((e) => piece.includes(~e));
  if (shared === undefined) throw new Error(`${cut.name}: the cut-off piece shares no border with ${into.properties.name}`);
  const rotate = (arr, i) => [...arr.slice(i + 1), ...arr.slice(0, i + 1)]; // ends with arr[i]
  const mine = rotate(target2, target2.indexOf(shared)).slice(0, -1);
  const theirs = rotate(piece, piece.indexOf(~shared)).slice(0, -1);
  into.arcs = [[...mine, ...theirs]];
  return true;
}


// Replaces a geometry's outline with polygons in degrees, as new arcs on the topology's grid. Outer rings are clockwise
// and holes counter-clockwise, as in the Natural Earth data.
function setGeometryPolygons(topology, geometry, polys) {
  const [sx, sy] = topology.transform.scale;
  const [tx, ty] = topology.transform.translate;
  const arcsOf = [];
  for (const poly of polys) {
    const rings = [];
    for (const [i, ring] of poly.entries()) {
      let pts = ring.map(([x, y]) => [Math.round((x - tx) / sx), Math.round((y - ty) / sy)]);
      pts = pts.filter((q, k) => k === 0 || q[0] !== pts[k - 1][0] || q[1] !== pts[k - 1][1]);
      if (pts.length < 4) { if (i === 0) break; continue; }
      if (ringArea(pts) < 0 !== (i === 0)) pts.reverse(); // grid y points up like latitude, so a negative shoelace is clockwise
      topology.arcs.push(pts.map(([x, y], k) => (k ? [x - pts[k - 1][0], y - pts[k - 1][1]] : [x, y])));
      rings.push([topology.arcs.length - 1]);
    }
    if (rings.length) arcsOf.push(rings);
  }
  geometry.type = "MultiPolygon";
  geometry.arcs = arcsOf;
  return geometry;
}

function cutTopologyDisputed(topology, cut) {
  const geometries = topology.objects.countries.geometries;
  if (geometries.some((g) => g.properties?.name === cut.name)) return false;
  const topo = topojsonClient();
  const polysOf = (g) => { const f = topo.feature(topology, g).geometry; return !f ? [] : f.type === "Polygon" ? [f.coordinates] : f.coordinates; };
  const ownerGeoms = cut.owners.map((o) => {
    const g = geometries.find((x) => x.id === o.numeric);
    if (!g) throw new Error(`Owner shape ${o.numeric} for ${cut.name} not found`);
    return g;
  });
  const absorbedGeom = geometries.find((g) => g.properties?.name === cut.absorb);
  const owners = new Map(ownerGeoms.map((g) => [g, polysOf(g)]));
  const { kept, neutral } = cutDisputed(owners, absorbedGeom ? polysOf(absorbedGeom) : [], cut);
  for (const [g, polys] of kept) setGeometryPolygons(topology, g, polys);
  const shape = absorbedGeom || { type: "MultiPolygon", arcs: [], properties: {} };
  shape.properties = { name: cut.name };
  delete shape.id;
  setGeometryPolygons(topology, shape, neutral);
  if (!absorbedGeom) geometries.push(shape);
  return true;
}

// Mutates the topology; returns the names of the shapes it added.
// With { disputed: false } the disputed areas stay inside their owners (the "uncut" atlas the regional maps read).
export function splitTopology(topology, { disputed = true } = {}) {
  const geometries = topology.objects.countries.geometries;
  const arcs = decodeArcs(topology);
  const added = [];
  for (const t of [...TERRITORIES, ...SHAPE_SPLITS, ...(disputed ? NEUTRAL_SPLITS : [])]) {
    if (geometries.some((g) => g.properties?.name === t.name)) continue;
    const parent = geometries.find((g) => g.id === t.parentNumeric);
    if (!parent) throw new Error(`Parent shape ${t.parentNumeric} for ${t.name} not found`);
    const polygons = parent.type === "Polygon" ? [parent.arcs] : parent.arcs;
    const taken = [];
    const kept = [];
    for (const polygon of polygons) {
      const [lon, lat] = polygonCentre(polygon, arcs);
      (inBoxes(t.boxes, lon, lat) ? taken : kept).push(polygon);
    }
    if (!taken.length) {
      if (t.optional) continue;
      throw new Error(`No part of ${parent.properties.name} found for ${t.name}`);
    }
    parent.type = "MultiPolygon";
    parent.arcs = kept;
    // No id: shape-rules.js links the shape to its countries.json entry by name.
    geometries.push({
      type: "MultiPolygon",
      arcs: taken,
      properties: { name: t.name },
    });
    added.push(t.name);
  }
  for (const cut of MERIDIAN_CUTS) if (cutTopologyByMeridian(topology, cut)) added.push(cut.name);
  for (const cut of PARALLEL_CUTS) if (cutTopologyByParallel(topology, cut)) added.push(cut.name);
  if (disputed) for (const cut of DISPUTED_CUTS) if (cutTopologyDisputed(topology, cut)) added.push(cut.name);
  return added;
}

// ---- world-map.svg ----
// Paths are straight-line rings in degrees: x = longitude, y = -latitude.

function ringCentre(ring) {
  const pts = ring.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g).map((p) => p.split(",").map(Number));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, -(Math.min(...ys) + Math.max(...ys)) / 2];
}

const round2 = (n) => Math.round(n * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;

// Returns { svg, added }.
export function splitSvg(svg, { disputed = true } = {}) {
  const added = [];
  for (const t of [...TERRITORIES, ...SHAPE_SPLITS, ...(disputed ? NEUTRAL_SPLITS : [])]) {
    if (svg.includes(`data-name="${t.name}"`)) continue;
    const parentRe = new RegExp(`<path id="(${t.parent})" class="([^"]*)" data-name="([^"]*)" data-cx="([^"]*)" data-cy="([^"]*)" d="([^"]*)"/>`, "g");
    let done = false;
    svg = svg.replace(parentRe, (whole, id, cls, name, cx, cy, d) => {
      if (done) return whole;
      const rings = d.match(/M[^M]*/g) || [];
      const taken = rings.filter((r) => inBoxes(t.boxes, ...ringCentre(r)));
      if (!taken.length) return whole;
      done = true;
      const kept = rings.filter((r) => !taken.includes(r));
      const pts = taken.flatMap((r) => ringCentre(r));
      const lons = pts.filter((_, i) => i % 2 === 0);
      const lats = pts.filter((_, i) => i % 2 === 1);
      const tcx = round2((Math.min(...lons) + Math.max(...lons)) / 2);
      const tcy = round2(-(Math.min(...lats) + Math.max(...lats)) / 2);
      const territory = `<path class="country${t.small ? " small" : ""} no-code${t.neutral ? " disputed" : ""}" data-name="${t.name}" data-cx="${tcx}" data-cy="${tcy}" d="${taken.join("")}"/>`;
      added.push({ name: t.name, small: t.small, cx: tcx, cy: tcy });
      return `<path id="${id}" class="${cls}" data-name="${name}" data-cx="${cx}" data-cy="${cy}" d="${kept.join("")}"/>\n${territory}`;
    });
    if (!done && !t.optional) throw new Error(`No ring of any map path found for ${t.name}`);
  }
  for (const cut of MERIDIAN_CUTS) {
    if (svg.includes(`data-name="${cut.name}"`)) continue;
    const re = new RegExp(`<path id="${cut.parent}" class="([^"]*)" data-name="([^"]*)" data-cx="([^"]*)" data-cy="([^"]*)" d="([^"]*)"/>`);
    const m = svg.match(re);
    if (!m) throw new Error(`No map path ${cut.parent} found for ${cut.name}`);
    const rings = m[5].match(/M[^M]*/g).map((r) => r.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g).map((p) => p.split(",").map(Number)));
    if (rings.length !== 1) throw new Error(`${cut.parent} has more than one ring`);
    const clip = (ring, keepEast) => { // x = longitude here
      const inside = (p) => (keepEast ? p[0] >= cut.lon : p[0] <= cut.lon);
      const out = [];
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        if (inside(p)) out.push(p);
        if (inside(p) !== inside(q)) out.push([cut.lon, round2(p[1] + ((cut.lon - p[0]) * (q[1] - p[1])) / (q[0] - p[0]))]);
      }
      return out;
    };
    const eastRing = clip(rings[0], true), westRing = clip(rings[0], false);
    const d = (ring) => "M" + ring.map(([x, y]) => `${x},${y}`).join("L") + "Z";
    const lons = eastRing.map((p) => p[0]), lats = eastRing.map((p) => p[1]);
    const gcx = round2((Math.min(...lons) + Math.max(...lons)) / 2), gcy = round2(-(Math.min(...lats) + Math.max(...lats)) / 2);
    const territory = `<path class="country no-code" data-name="${cut.name}" data-cx="${gcx}" data-cy="${gcy}" d="${d(eastRing)}"/>`;
    svg = svg.replace(re, `<path id="${cut.parent}" class="${m[1]}" data-name="${m[2]}" data-cx="${m[3]}" data-cy="${m[4]}" d="${d(westRing)}"/>\n${territory}`);
    added.push({ name: cut.name, small: false, cx: gcx, cy: gcy });
  }
  for (const cut of PARALLEL_CUTS) {
    // Morocco's ring is cut along the parallel; the part south of it is spliced into Western Sahara's ring. The two rings
    // already share the berm's vertices, so the cut-off piece and the old shape meet along them and that run drops out.
    const pathRe = (id) => new RegExp(`<path id="${id}" class="([^"]*)" data-name="([^"]*)" data-cx="([^"]*)" data-cy="([^"]*)" d="([^"]*)"/>`);
    const mp = svg.match(pathRe(cut.parent)), ip = svg.match(pathRe(cut.into));
    if (!mp || !ip) throw new Error(`No map paths ${cut.parent} / ${cut.into} found for ${cut.name}`);
    const parse = (d) => {
      const rings = d.match(/M[^M]*/g).map((r) => r.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g));
      if (rings.length !== 1) throw new Error(`${cut.name}: a map path has more than one ring`);
      return rings[0];
    };
    const ring = parse(mp[5]), target = parse(ip[5]);
    const num = (pt) => pt.split(",").map(Number);
    const inTarget = new Set(target);
    // the cut runs through the shared vertex nearest the parallel (y = -latitude)
    const yCut = ring.filter((pt) => inTarget.has(pt)).map((pt) => num(pt)[1]).reduce((best, y) => (Math.abs(y + cut.lat) < Math.abs(best + cut.lat) ? y : best), Infinity);
    if (!(Math.abs(yCut + cut.lat) <= 0.05)) throw new Error(`${cut.name}: no shared vertex near ${cut.lat}°N`);
    if (!ring.some((pt) => num(pt)[1] > yCut + 1e-9)) continue; // already cut
    const clip = (pts, keepSouth) => { // y = -latitude, so south is larger y
      const inside = (p) => (keepSouth ? p[1] >= yCut : p[1] <= yCut);
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const p = num(pts[i]), q = num(pts[(i + 1) % pts.length]);
        if (inside(p)) out.push(pts[i]);
        if (inside(p) !== inside(q)) out.push(`${round2(p[0] + ((yCut - p[1]) * (q[0] - p[0])) / (q[1] - p[1]))},${yCut}`);
      }
      return out;
    };
    const north = clip(ring, false), southRing = clip(ring, true);
    const inSouth = new Set(southRing);
    const isShared = (pt) => inSouth.has(pt);
    // the single run of vertices the old shape and the cut-off piece have in common (in the old shape's order)
    const n = target.length;
    const flags = target.map(isShared);
    const starts = flags.map((f, i) => f && !flags[(i + n - 1) % n]);
    if (starts.filter(Boolean).length !== 1) throw new Error(`${cut.name}: the shapes do not meet along one run of vertices`);
    const a = starts.indexOf(true);
    let b = a;
    while (flags[(b + 1) % n]) b = (b + 1) % n;
    const own = []; // from the run's end, round the old shape's own vertices, to the run's start (both inclusive)
    for (let i = b; ; i = (i + 1) % n) { own.push(target[i]); if (i === a) break; }
    const m = southRing.length;
    const k = southRing.indexOf(target[a]);
    const piece = []; // the cut-off piece's own vertices, after the run's start vertex
    for (let i = (k + 1) % m; !inTarget.has(southRing[i]); i = (i + 1) % m) piece.push(southRing[i]);
    const merged = [...own, ...piece];
    const d = (pts) => "M" + pts.join("L") + "Z";
    const centre = (pts) => {
      const xs = pts.map((q) => num(q)[0]), ys = pts.map((q) => num(q)[1]);
      return [round2((Math.min(...xs) + Math.max(...xs)) / 2), round2((Math.min(...ys) + Math.max(...ys)) / 2)];
    };
    const [mx, my] = centre(north), [ix, iy] = centre(merged);
    svg = svg
      .replace(mp[0], `<path id="${cut.parent}" class="${mp[1]}" data-name="${mp[2]}" data-cx="${mx}" data-cy="${my}" d="${d(north)}"/>`)
      .replace(ip[0], `<path id="${cut.into}" class="${ip[1]}" data-name="${ip[2]}" data-cx="${ix}" data-cy="${iy}" d="${d(merged)}"/>`);
    added.push({ name: cut.name, small: false, cx: ix, cy: iy });
  }
  if (disputed) for (const cut of DISPUTED_CUTS) {
    // Same cut as the topology's, on the map's own rings (x = longitude, y = -latitude): the area comes out of each owner's
    // path and the old Siachen Glacier path becomes the neutral shape.
    if (svg.includes(`data-name="${cut.name}"`)) continue;
    const pathRe = (id) => new RegExp(`<path id="${id}" class="([^"]*)" data-name="([^"]*)" data-cx="([^"]*)" data-cy="([^"]*)" d="([^"]*)"/>`);
    const toPolys = (d) => d.match(/M[^M]*/g).map((r) => {
      const ring = r.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g).map((q) => { const [x, y] = q.split(",").map(Number); return [x, -y]; });
      return [[...ring, ring[0]]];
    });
    const owners = new Map();
    const matches = new Map();
    for (const o of cut.owners) {
      const m = svg.match(pathRe(o.alpha2));
      if (!m) throw new Error(`No map path ${o.alpha2} found for ${cut.name}`);
      matches.set(o.alpha2, m);
      owners.set(o.alpha2, toPolys(m[5]));
    }
    const siachen = svg.match(new RegExp(`<path class="[^"]*" data-name="${cut.absorb}" data-cx="[^"]*" data-cy="[^"]*" d="([^"]*)"/>`));
    const { kept, neutral } = cutDisputed(owners, siachen ? toPolys(siachen[1]) : [], cut);
    const dOf = (polys) => polys.map((poly) => {
      if (poly.length > 1) throw new Error(`${cut.name}: a map ring has a hole (${poly.slice(1).map((r) => `${r.length} pts at ${r[0]}`).join('; ')}; outer starts ${poly[0][0]})`);
      return "M" + poly[0].slice(0, -1).map(([x, y]) => `${round3(x)},${round3(-y)}`).join("L") + "Z"; // 3 decimals: at 2, the cut's new vertices can tangle with the old border
    }).join("");
    for (const [id, polys] of kept) {
      const m = matches.get(id);
      svg = svg.replace(m[0], `<path id="${id}" class="${m[1]}" data-name="${m[2]}" data-cx="${m[3]}" data-cy="${m[4]}" d="${dOf(polys)}"/>`);
    }
    const xs = neutral.flatMap((p) => p[0].map((q) => q[0])), ys = neutral.flatMap((p) => p[0].map((q) => q[1]));
    const cx = round2((Math.min(...xs) + Math.max(...xs)) / 2), cy = round2(-(Math.min(...ys) + Math.max(...ys)) / 2);
    const shape = `<path class="country no-code disputed" data-name="${cut.name}" data-cx="${cx}" data-cy="${cy}" d="${dOf(neutral)}"/>`;
    if (siachen) svg = svg.replace(siachen[0], shape);
    else svg = svg.replace("</g>\n<g id=\"hit-targets\"", `${shape}\n</g>\n<g id="hit-targets"`);
    added.push({ name: cut.name, small: false, cx, cy });
  }
  // the hatch the neutral shapes are filled with (colors come from the page's CSS variables, so it follows the theme)
  if (!svg.includes('id="disputed-hatch"')) {
    svg = svg.replace(/(<svg[^>]*>)\n/, `$1\n<defs><pattern id="disputed-hatch" width="0.9" height="0.9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.9" height="0.9" class="hatch-base"/><line x1="0" y1="0" x2="0" y2="0.9" class="hatch-line"/></pattern></defs>\n`);
    added.push({ name: "hatch", small: false, cx: 0, cy: 0, pattern: true });
  }
  return { svg, added };
}

// The tap targets for tiny shapes are circles after the paths, keyed by alpha2.
export function addHitTargets(svg, targets) {
  const circles = targets
    .filter((t) => !svg.includes(`data-name="${t.name}" cx=`))
    .map((t) => `<circle class="hit-target" data-code="${t.code}" data-name="${t.name}" cx="${t.cx}" cy="${t.cy}" r="1"/>`);
  return circles.length ? svg.replace("</g>\n</svg>", `${circles.join("\n")}\n</g>\n</svg>`) : svg;
}

// ---- CLI ----

const HIT_TARGET_CODES = { Guadeloupe: "GP", Martinique: "MQ", Réunion: "RE", Mayotte: "YT", "Bonaire, Sint Eustatius and Saba": "BQ" };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const file of ["data/countries-50m.json", "data/countries-50m-full.json", "data/countries-10m.json"]) {
    const p = path.join(root, file);
    const topology = JSON.parse(fs.readFileSync(p, "utf8"));
    const added = splitTopology(topology);
    if (added.length) fs.writeFileSync(p, JSON.stringify(topology));
    console.log(`${file}: ${added.length ? `added ${added.join(", ")}` : "already split"}`);
  }
  const countriesPath = path.join(root, "data/countries.json");
  const countries = JSON.parse(fs.readFileSync(countriesPath, "utf8"));
  countries.forEach((c) => {
    if (TERRITORY_PARENTS[c.alpha2Code]) c.parent = TERRITORY_PARENTS[c.alpha2Code];
  });
  fs.writeFileSync(countriesPath, JSON.stringify(countries));
  console.log("data/countries.json: parent notes set");

  const svgPath = path.join(root, "world-map.svg");
  const { svg, added } = splitSvg(fs.readFileSync(svgPath, "utf8"));
  const withTargets = addHitTargets(
    svg,
    added.filter((a) => a.small).map((a) => ({ name: a.name, code: HIT_TARGET_CODES[a.name], cx: a.cx, cy: a.cy }))
  );
  if (added.length) fs.writeFileSync(svgPath, withTargets);
  console.log(`world-map.svg: ${added.length ? `added ${added.map((a) => a.name).join(", ")}` : "already split"}`);
}
