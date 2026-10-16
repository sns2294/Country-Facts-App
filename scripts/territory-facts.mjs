// Population (with its year) and area for the territories split out of their
// parent countries' map shapes (see split-territories.mjs). The World Bank and
// the Factbook fold these into the parent, and countries.dev has an undated
// population and often no area, so they come from Wikidata, which carries the
// national statistics offices' figures (INSEE, CBS Netherlands, Statistics
// Norway) with the year each was counted.
//
//   node scripts/territory-facts.mjs   patches data/countries.json in place
//
// scripts/update-data.mjs calls the same functions on every refresh.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TERRITORIES } from "./split-territories.mjs";

const USER_AGENT = "country-facts-app-data-updater/1.0 (https://github.com/sns2294/country-facts-app)";

export const FACT_CODES = TERRITORIES.map((t) => t.alpha2);

// { alpha2 -> { population, year, area } } using each territory's most recent
// dated population figure and its area in km². Missing values are left out.
export async function loadTerritoryFacts() {
  const query = `SELECT ?iso2 ?pop ?year ?area WHERE {
    VALUES ?iso2 { ${FACT_CODES.map((c) => `"${c}"`).join(" ")} }
    ?c wdt:P297 ?iso2 .
    OPTIONAL { ?c wdt:P2046 ?area }
    OPTIONAL { ?c p:P1082 ?ps . ?ps ps:P1082 ?pop . ?ps pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
  } ORDER BY ?iso2 DESC(?year)`;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`;
  let body;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/sparql-results+json" } });
    if (res.ok) {
      body = await res.json();
      break;
    }
    if (attempt === 3) throw new Error(`Wikidata territory facts: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  const facts = new Map();
  for (const row of body.results.bindings) {
    const code = row.iso2.value;
    const f = facts.get(code) || {};
    if (row.area && f.area === undefined) f.area = Math.round(Number(row.area.value));
    // Rows are newest-first, so the first dated population is the latest.
    if (row.pop && row.year && f.population === undefined) {
      f.population = Number(row.pop.value);
      f.year = row.year.value;
    }
    facts.set(code, f);
  }
  return facts;
}

// Overwrites population/year/area on a countries.json entry; returns true if it changed anything.
export function applyTerritoryFacts(entry, facts) {
  const f = facts.get(entry.alpha2Code);
  if (!f) return false;
  if (f.population !== undefined) {
    entry.population = f.population;
    entry.populationYear = f.year;
  }
  if (f.area !== undefined) entry.area = f.area;
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data/countries.json");
  const countries = JSON.parse(fs.readFileSync(file, "utf8"));
  const facts = await loadTerritoryFacts();
  for (const c of countries) {
    if (applyTerritoryFacts(c, facts)) console.log(`${c.alpha2Code} ${c.name}: ${c.population} (${c.populationYear}), ${c.area} km²`);
  }
  fs.writeFileSync(file, JSON.stringify(countries));
}
