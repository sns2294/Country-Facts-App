#!/usr/bin/env node
// Extracts the Kashmir region's disputed areas for the labelled maps (scripts/build-maps.mjs) from Natural Earth's
// "Admin-0 disputed areas" file.
//
//   node scripts/extract-disputed.mjs path/to/ne_10m_admin_0_disputed_areas.geojson     writes map-data/disputed.json
//
// Source: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/ (public domain; the GeoJSON copy is in
// https://github.com/nvkelso/natural-earth-vector). Natural Earth tags each area with who administers it and who
// claims it; the maps draw these areas without assigning them to a country (the same rule the site applies to the
// Siachen Glacier). Only the areas the maps show are kept, in named groups. "kashmir": Indian-administered Jammu and Kashmir (with Ladakh), Azad
// Kashmir, Gilgit-Baltistan, Aksai Chin and the Shaksgam Valley (Chinese-administered), the Siachen Glacier, and
// Demchok (a small Indian-administered part of Ladakh that China claims). "kurils", "senkaku" and "dokdo": the Southern Kuril
// Islands, the Senkaku / Diaoyu Islands and Dokdo / Takeshima.
//
// Output: [{ group, name, admin, note, p: [polygon, ...] }], a polygon being [outer ring, ...inner rings] of [lon, lat].

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const input = process.argv[2];
if (!input) { console.error("usage: node scripts/extract-disputed.mjs path/to/ne_10m_admin_0_disputed_areas.geojson"); process.exit(1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GROUPS = {
  kashmir: ["Jammu and Kashmir", "Azad Kashmir", "Gilgit-Baltistan", "Aksai Chin", "Shaksam Valley", "Siachen Glacier", "Demchok"],
  kurils: ["Kuril Is."], // the southern Kurils: administered by Russia, claimed by Japan
  senkaku: ["Pinnacle Is."], // Senkaku / Diaoyu: administered by Japan, claimed by China and Taiwan
  dokdo: ["Dokdo"], // Dokdo / Takeshima: administered by South Korea, claimed by Japan
};
const groupOf = (name) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(name));
const WANTED = Object.values(GROUPS).flat();

const data = JSON.parse(fs.readFileSync(input, "utf8"));
const out = [];
for (const f of data.features) {
  const { BRK_NAME, ADMIN, NOTE_BRK } = f.properties;
  if (!WANTED.includes(BRK_NAME)) continue;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  out.push({ group: groupOf(BRK_NAME), name: BRK_NAME, admin: ADMIN, note: NOTE_BRK, p: polys.map((poly) => poly.map((ring) => ring.slice(0, -1).map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]))) });
}
if (out.length !== WANTED.length) throw new Error(`Expected ${WANTED.length} areas, found ${out.length}`);
fs.writeFileSync(path.join(ROOT, "map-data/disputed.json"), JSON.stringify(out));
console.log(`map-data/disputed.json: ${out.map((a) => `${a.name} (${a.admin})`).join(", ")}`);
