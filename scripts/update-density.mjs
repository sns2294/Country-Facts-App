// Writes data/population-density.json: people per km² of land area, for the population density map (maps/population-density/).
// World Bank EN.POP.DNST, 2023 values (the latest year with near-complete coverage: 2024 had values for only 214 of 263 economies),
// downloaded once here and stored in the repo; the site never calls the API. Three sovereign states the World Bank has no value for
// (Taiwan, Kosovo, Vatican City) get a value computed from national statistics, recorded below with source, year and figures.
// Usage: node scripts/update-density.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const YEAR = 2023;
const URL_ = `https://api.worldbank.org/v2/country/all/indicator/EN.POP.DNST?format=json&date=${YEAR}&per_page=1000`;

const NATIONAL = {
  TWN: { name: "Taiwan", population: 23424442, populationDate: "end of 2023", populationSource: "Ministry of the Interior (Taiwan), as reported by Taiwan News", area: 36197, areaSource: "Taiwan at a Glance 2023-2024 (total area, including the outlying islands)", year: 2023 },
  UNK: { name: "Kosovo", population: 1585566, populationDate: "April 2024 census", populationSource: "Kosovo Agency of Statistics, 2024 census", area: 10887, areaSource: "Kosovo Agency of Statistics / Wikipedia infobox", year: 2024 },
  VAT: { name: "Vatican City", population: 882, populationDate: "31 December 2024", populationSource: "Governorate of Vatican City State (residents, citizens and non-citizens)", area: 0.44, areaSource: "Governorate of Vatican City State", year: 2024 },
};

const res = await fetch(URL_);
if (!res.ok) throw new Error(`World Bank API: HTTP ${res.status}`);
const [, rows] = await res.json();
const countries = JSON.parse(fs.readFileSync(path.join(ROOT, "data/countries.json"), "utf8"));
const wb = new Map(rows.filter((r) => r.value != null && /^[A-Z]{3}$/.test(r.countryiso3code)).map((r) => [r.countryiso3code, r.value]));

const values = {};
for (const c of countries) {
  const a3 = c.alpha3Code;
  if (wb.has(a3)) values[a3] = { density: Math.round(wb.get(a3) * 100) / 100, source: "worldbank" };
  else if (NATIONAL[a3]) {
    const n = NATIONAL[a3];
    values[a3] = { density: Math.round((n.population / n.area) * 10) / 10, source: "national", year: n.year, population: n.population, populationDate: n.populationDate, populationSource: n.populationSource, area: n.area, areaSource: n.areaSource };
  }
}
const out = {
  indicator: "EN.POP.DNST",
  description: "Population density, people per km² of land area",
  source: "World Bank, https://data.worldbank.org/indicator/EN.POP.DNST",
  year: YEAR,
  note: "Entries with source \"national\" are computed (population / area) from the national statistics recorded on them, not from the World Bank. Countries and territories not listed have no data.",
  values,
};
fs.writeFileSync(path.join(ROOT, "data/population-density.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`data/population-density.json: ${Object.keys(values).length} of ${countries.length} entries (${Object.values(values).filter((v) => v.source === "national").length} computed)`);
