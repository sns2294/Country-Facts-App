#!/usr/bin/env node
// Downloads every dataset the app needs and writes it to ./data so the site
// never calls a live API. Re-run any time to refresh:
//
//   node scripts/update-data.mjs
//
// Requires Node 18+ and a `tar` binary (macOS, Linux, Windows 10+ all ship one).
// Everything is built in a staging folder first; ./data is only replaced if
// every source downloaded and validated, so a failed run never leaves the
// site with partial data.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const STAGING_DIR = path.join(ROOT, "data.staging");

const SOURCES = {
  countries: "https://countries.dev/countries",
  worldBankGdp:
    "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&mrnev=1&per_page=400",
  worldBankPopulation:
    "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=400",
  worldAtlas: "https://unpkg.com/world-atlas@2.0.2/countries-110m.json",
  factbook: "https://codeload.github.com/factbook/factbook.json/tar.gz/refs/heads/master",
  flagIcons: "https://registry.npmjs.org/flag-icons/-/flag-icons-7.2.3.tgz",
  wikidata: "https://query.wikidata.org/sparql",
};

const USER_AGENT = "country-facts-app-data-updater/1.0 (https://github.com/sns2294/country-facts-app)";

// Factbook files are keyed by CIA/FIPS code. Wikidata supplies most FIPS->ISO
// pairs; these cover entries it lacks. Value is the factbook file name.
const FACTBOOK_OVERRIDES = {
  NL: "nl",
  PS: "we", // West Bank
};

// Territories countries.dev lists as land borders of the country they belong
// to. Keyed by alpha2 code of the country whose list to trim; values are the
// alpha3 codes to drop from it.
const BORDER_EXCLUSIONS = {
  CN: ["HKG", "MAC"], // Hong Kong and Macao are Special Administrative Regions of China
};

// Religion names as the Factbook writes them -> broad group shown in the app.
// Order matters: the first matching pattern wins.
const RELIGION_GROUPS = [
  ["Non-religious", /\b(none|atheist|no religion|unaffiliated|non-?religious|irreligio)/i],
  ["Christianity", /christian|catholic|protestant|orthodox|anglican|lutheran|pentecost|evangel|baptist|methodist|presbyter|adventist|coptic|mormon|latter|reformed|calvin|apostolic/i],
  ["Islam", /muslim|sunni|shia|shi'a|islam|ibadi|alawite|ahmadi/i],
  ["Hinduism", /hindu/i],
  ["Buddhism", /buddh/i],
  ["Judaism", /jewish|judaism/i],
  ["Shintoism", /shinto/i],
  ["Sikhism", /sikh/i],
  ["Folk/Indigenous religions", /folk|animis|traditional|indigenous|spiritis|vodou|voodoo|santeria|african|tribal/i],
];
const NON_RELIGIOUS = "Non-religious";
const MAX_RELIGION_GROUPS = 3;
const MAX_GOVERNMENT_LENGTH = 90;

function log(msg) {
  console.log(msg);
}

async function download(url, { json = false, asBuffer = false, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (json) return await res.json();
      return asBuffer ? Buffer.from(await res.arrayBuffer()) : await res.text();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error(`Failed to download ${url}: ${lastErr.message}`);
}

async function downloadAndExtract(url, destDir) {
  const tgz = path.join(destDir, "archive.tgz");
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(tgz, await download(url, { asBuffer: true }));
  execFileSync("tar", ["xzf", tgz, "-C", destDir]);
  fs.rmSync(tgz);
}

function decodeEntities(s) {
  return String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanGovernment(raw) {
  const text = decodeEntities(raw);
  if (!text) return null;
  const cleaned = text.split(";")[0].replace(/\s*\(.*$/, "").trim();
  if (!cleaned || cleaned.length > MAX_GOVERNMENT_LENGTH) return null;
  return cleaned;
}

// "Roman Catholic 47%, Muslim 4%, ... none 33%" -> top groups by summed share.
// Ranges use their midpoint and "<1%" counts as half of 1. If the Factbook
// gives no percentages at all (e.g. "Sunni Muslim (official)"), the groups it
// names are returned in order of mention with pct: null.
function parseReligions(raw) {
  const text = decodeEntities(raw).replace(/\((?:[^()]|\([^()]*\))*\)/g, (m) => (/est\.\)$/.test(m) ? "" : " "));
  const parts = text.split(",");
  const totals = new Map();
  for (const part of parts) {
    const pct = part.match(/(<)?\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*%/);
    if (!pct) continue;
    const name = part.slice(0, pct.index).trim();
    const group = RELIGION_GROUPS.find(([, re]) => re.test(name))?.[0];
    if (!group) continue;
    let value = parseFloat(pct[2]);
    if (pct[3]) value = (value + parseFloat(pct[3])) / 2;
    if (pct[1]) value /= 2;
    totals.set(group, (totals.get(group) || 0) + value);
  }
  if (totals.size) {
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_RELIGION_GROUPS)
      .map(([name, pct]) => ({ name, pct: Math.round(pct * 10) / 10 }));
  }
  const named = [];
  for (const part of parts) {
    const group = RELIGION_GROUPS.find(([, re]) => re.test(part))?.[0];
    if (group && !named.includes(group)) named.push(group);
  }
  return named.slice(0, MAX_RELIGION_GROUPS).map((name) => ({ name, pct: null }));
}

async function loadWikidata() {
  const query = `SELECT ?iso2 ?fips ?govLabel WHERE {
    ?c wdt:P297 ?iso2 .
    OPTIONAL { ?c wdt:P901 ?fips }
    OPTIONAL { ?c wdt:P122 ?gov }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
  }`;
  const data = await download(`${SOURCES.wikidata}?query=${encodeURIComponent(query)}`, {
    json: true,
    headers: { Accept: "application/sparql-results+json" },
  });
  const fipsToIso = new Map();
  const governments = new Map();
  for (const row of data.results.bindings) {
    const iso = row.iso2.value;
    if (row.fips) fipsToIso.set(row.fips.value.toLowerCase(), iso);
    const label = row.govLabel?.value;
    if (label && !/^Q\d+$/.test(label) && !governments.has(iso)) governments.set(iso, label.toLowerCase());
  }
  return { fipsToIso, governments };
}

function loadFactbook(extractedRoot) {
  const profiles = new Map();
  for (const region of fs.readdirSync(extractedRoot)) {
    const dir = path.join(extractedRoot, region);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      profiles.set(file.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
    }
  }
  return profiles;
}

// Most recent non-empty value of a World Bank indicator for every country,
// keyed by alpha2 code: { value, year }.
async function loadWorldBankIndicator(url) {
  const body = await download(url, { json: true });
  if (!Array.isArray(body?.[1])) throw new Error("Unexpected World Bank response shape");
  const byAlpha2 = new Map();
  for (const entry of body[1]) {
    if (entry.country?.id && typeof entry.value === "number") {
      byAlpha2.set(entry.country.id, { value: entry.value, year: entry.date });
    }
  }
  return byAlpha2;
}

async function main() {
  if (Number(process.versions.node.split(".")[0]) < 18) throw new Error("Node 18 or newer is required");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "country-facts-"));
  try {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
    fs.mkdirSync(path.join(STAGING_DIR, "flags"), { recursive: true });

    log("Downloading countries.dev…");
    const rawCountries = await download(SOURCES.countries, { json: true });
    if (!Array.isArray(rawCountries) || rawCountries.length < 200) throw new Error("countries.dev returned too few countries");

    log("Downloading World Bank GDP and population…");
    const gdpByAlpha2 = await loadWorldBankIndicator(SOURCES.worldBankGdp);
    const populationByAlpha2 = await loadWorldBankIndicator(SOURCES.worldBankPopulation);

    log("Downloading world-atlas shapes…");
    const atlas = await download(SOURCES.worldAtlas, { json: true });
    if (!atlas?.objects?.countries) throw new Error("world-atlas file has no countries object");
    fs.writeFileSync(path.join(STAGING_DIR, "countries-110m.json"), JSON.stringify(atlas));

    log("Downloading CIA World Factbook (factbook.json)…");
    await downloadAndExtract(SOURCES.factbook, path.join(tmp, "factbook"));
    const factbookRoot = path.join(tmp, "factbook", fs.readdirSync(path.join(tmp, "factbook"))[0]);
    const factbook = loadFactbook(factbookRoot);
    if (factbook.size < 200) throw new Error("Factbook archive looks incomplete");

    log("Downloading Wikidata code map and government fallback…");
    const wikidata = await loadWikidata();

    log("Downloading flag icons…");
    await downloadAndExtract(SOURCES.flagIcons, path.join(tmp, "flags"));
    const flagDir = path.join(tmp, "flags", "package", "flags", "4x3");

    const countries = [];
    const stats = { government: 0, governmentFromWikidata: 0, religion: 0, gdp: 0, populationWorldBank: 0, populationFallback: 0, missingFlags: [] };

    for (const c of rawCountries) {
      if (!c?.name || !c.alpha2Code) continue;
      const iso2 = c.alpha2Code;

      const profileKey =
        FACTBOOK_OVERRIDES[iso2] ||
        [...wikidata.fipsToIso.entries()].find(([, iso]) => iso === iso2)?.[0];
      const profile = profileKey ? factbook.get(profileKey) : null;

      let governmentType = cleanGovernment(profile?.Government?.["Government type"]?.text);
      if (governmentType) {
        stats.government++;
      } else if (wikidata.governments.has(iso2)) {
        governmentType = cleanGovernment(wikidata.governments.get(iso2));
        if (governmentType) {
          stats.government++;
          stats.governmentFromWikidata++;
        }
      }

      const religions = parseReligions(profile?.["People and Society"]?.Religions?.text);
      if (religions.length) stats.religion++;

      const gdp = gdpByAlpha2.get(iso2) || null;
      if (gdp) stats.gdp++;

      // World Bank first (latest year); countries.dev only where it has no figure.
      const wbPopulation = populationByAlpha2.get(iso2);
      let population = null;
      let populationYear = null;
      if (wbPopulation) {
        population = wbPopulation.value;
        populationYear = wbPopulation.year;
        stats.populationWorldBank++;
      } else if (typeof c.population === "number") {
        population = c.population;
        stats.populationFallback++;
      }

      const excludedBorders = BORDER_EXCLUSIONS[iso2] || [];
      const borders = (c.borders || []).filter((code) => !excludedBorders.includes(code));

      const flagFile = `${iso2.toLowerCase()}.svg`;
      const flagSrc = path.join(flagDir, flagFile);
      let flag = null;
      if (fs.existsSync(flagSrc)) {
        fs.copyFileSync(flagSrc, path.join(STAGING_DIR, "flags", flagFile));
        flag = `data/flags/${flagFile}`;
      } else {
        stats.missingFlags.push(iso2);
      }

      countries.push({
        name: c.name,
        nativeName: c.nativeName || null,
        alpha2Code: iso2,
        alpha3Code: c.alpha3Code || null,
        numericCode: c.numericCode || null,
        capital: c.capital || null,
        region: c.region || null,
        subregion: c.subregion || null,
        population,
        populationYear,
        area: typeof c.area === "number" ? c.area : null,
        demonym: c.demonym || null,
        languages: (c.languages || []).map((l) => ({ name: l.name })),
        currencies: (c.currencies || []).map((cur) => ({ code: cur.code, name: cur.name, symbol: cur.symbol })),
        borders,
        flags: flag ? { svg: flag } : {},
        governmentType,
        religions,
        gdp,
      });
    }

    countries.sort((a, b) => a.name.localeCompare(b.name));
    if (countries.length < 200) throw new Error("Too few countries after processing");
    fs.writeFileSync(path.join(STAGING_DIR, "countries.json"), JSON.stringify(countries));

    const meta = {
      updatedAt: new Date().toISOString(),
      sources: {
        countries: "countries.dev (GeoNames, CC BY 4.0)",
        governmentAndReligion: "CIA World Factbook via factbook/factbook.json (CC0); government fallback: Wikidata (CC0)",
        gdp: "World Bank, NY.GDP.MKTP.CD (CC BY 4.0)",
        population: "World Bank, SP.POP.TOTL (CC BY 4.0); countries.dev fallback where missing",
        shapes: "world-atlas 2.0.2 / Natural Earth (public domain)",
        flags: "flag-icons 7.2.3 (MIT)",
      },
    };
    fs.writeFileSync(path.join(STAGING_DIR, "meta.json"), JSON.stringify(meta, null, 2) + "\n");

    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    fs.renameSync(STAGING_DIR, DATA_DIR);

    log(`\nDone: ${countries.length} countries written to data/ (${meta.updatedAt})`);
    log(`  government type: ${stats.government} (${stats.governmentFromWikidata} from Wikidata)`);
    log(`  religion:        ${stats.religion}`);
    log(`  GDP:             ${stats.gdp}`);
    log(`  population:      ${stats.populationWorldBank} World Bank, ${stats.populationFallback} countries.dev fallback`);
    if (stats.missingFlags.length) log(`  missing flags:   ${stats.missingFlags.join(", ")}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`\nUpdate failed, data/ left unchanged: ${err.message}`);
  process.exit(1);
});
