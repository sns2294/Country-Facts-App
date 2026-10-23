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

// Mutates the topology; returns the names of the shapes it added.
export function splitTopology(topology) {
  const geometries = topology.objects.countries.geometries;
  const arcs = decodeArcs(topology);
  const added = [];
  for (const t of TERRITORIES) {
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
    if (!taken.length) throw new Error(`No part of ${parent.properties.name} found for ${t.name}`);
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

// Returns { svg, added }.
export function splitSvg(svg) {
  const added = [];
  for (const t of TERRITORIES) {
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
      const territory = `<path class="country${t.small ? " small" : ""} no-code" data-name="${t.name}" data-cx="${tcx}" data-cy="${tcy}" d="${taken.join("")}"/>`;
      added.push({ name: t.name, small: t.small, cx: tcx, cy: tcy });
      return `<path id="${id}" class="${cls}" data-name="${name}" data-cx="${cx}" data-cy="${cy}" d="${kept.join("")}"/>\n${territory}`;
    });
    if (!done) throw new Error(`No ring of any map path found for ${t.name}`);
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
