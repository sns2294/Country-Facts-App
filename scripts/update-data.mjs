#!/usr/bin/env node
// Downloads every dataset the app needs and writes it to ./data so the site
// never calls a live API. Re-run any time to refresh:
//
//   node scripts/update-data.mjs
//   node scripts/update-data.mjs --audit-religion   (report only, writes nothing)
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
import { simplifyTopology } from "./simplify-topology.mjs";
import { splitTopology, TERRITORY_PARENTS } from "./split-territories.mjs";
import { loadTerritoryFacts, applyTerritoryFacts } from "./territory-facts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const STAGING_DIR = path.join(ROOT, "data.staging");

const SOURCES = {
  countries: "https://countries.dev/countries",
  worldBankGdp:
    "https://api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&mrnev=1&per_page=400",
  worldBankPopulation:
    "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=400",
  worldAtlas: "https://unpkg.com/world-atlas@2.0.2/countries-50m.json",
  factbook: "https://codeload.github.com/factbook/factbook.json/tar.gz/refs/heads/master",
  flagIcons: "https://registry.npmjs.org/flag-icons/-/flag-icons-7.2.3.tgz",
  wikidata: "https://query.wikidata.org/sparql",
};

// Fraction of the 50m atlas's points kept for the globe's default shapes. The
// full-detail atlas is also saved (countries-50m-full.json) and loaded only when
// the globe is zoomed in far enough for the simplified shapes to look rough.
const ATLAS_KEEP_FRACTION = 1 / 2;

const USER_AGENT = "country-facts-app-data-updater/1.0 (https://github.com/sns2294/country-facts-app)";

// Factbook files are keyed by CIA/FIPS code. Wikidata supplies most FIPS->ISO
// pairs; these cover entries it lacks. Value is the factbook file name.
const FACTBOOK_OVERRIDES = {
  NL: "nl",
  PS: "we", // West Bank
  SJ: "sv", // Svalbard; the Factbook files Jan Mayen separately
};

// Sovereign states for the geography quiz: the 193 UN member states plus the
// two UN observer states (Vatican City, Palestine). Territories, dependencies
// and partly recognized states (Taiwan, Kosovo, Western Sahara, Cook Islands,
// Niue) are not included.
const SOVEREIGN_ALPHA2 = new Set([
  "AF", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AU", "AT", "AZ", "BS", "BH", "BD", "BB",
  "BY", "BE", "BZ", "BJ", "BT", "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "CV", "KH",
  "CM", "CA", "CF", "TD", "CL", "CN", "CO", "KM", "CG", "CD", "CR", "CI", "HR", "CU", "CY",
  "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FJ", "FI",
  "FR", "GA", "GM", "GE", "DE", "GH", "GR", "GD", "GT", "GN", "GW", "GY", "HT", "HN", "HU",
  "IS", "IN", "ID", "IR", "IQ", "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KI", "KP",
  "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MG", "MW", "MY",
  "MV", "ML", "MT", "MH", "MR", "MU", "MX", "FM", "MD", "MC", "MN", "ME", "MA", "MZ", "MM",
  "NA", "NR", "NP", "NL", "NZ", "NI", "NE", "NG", "MK", "NO", "OM", "PK", "PW", "PA", "PG",
  "PY", "PE", "PH", "PL", "PT", "QA", "RO", "RU", "RW", "KN", "LC", "VC", "WS", "SM", "ST",
  "SA", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB", "SO", "ZA", "SS", "ES", "LK", "SD",
  "SR", "SE", "CH", "SY", "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN", "TR", "TM", "TV",
  "UG", "UA", "AE", "GB", "US", "UY", "UZ", "VU", "VE", "VN", "YE", "ZM", "ZW", "VA", "PS",
]);

// Territories countries.dev lists as land borders of the country they belong
// to. Keyed by alpha2 code of the country whose list to trim; values are the
// alpha3 codes to drop from it.
const BORDER_EXCLUSIONS = {
  CN: ["HKG", "MAC"], // Hong Kong and Macao are Special Administrative Regions of China
};

// Religion names as the Factbook writes them -> broad group shown in the app.
// Order matters: the first matching pattern wins.
const RELIGION_GROUPS = [
  ["Non-religious", /\b(none|atheist|no religion|unaffiliated|non-?religious|irreligio)|agnostic|non-?believer|humanist|nothing in particular/i],
  // National and denominational churches ("Church of Norway", "Church of
  // Sweden", ...) are caught by "church"; the rest are named churches and
  // movements the Factbook lists without a "Christian" label.
  ["Christianity", /christian|catholic|protestant|orthodox|anglican|lutheran|pentecost|evangel|baptist|methodist|presbyter|adventist|coptic|mormon|latter|reformed|calvin|apostolic|church|congregation|maronite|melkite|chaldean|syriac|jehovah|witness|jesus christ|iglesia ni cristo|salvation army|salutiste|assembl\w* of god|kimbangu|universal kingdom|worship cent|ekalesia|saio|zione|old believer|\bmana\b/i],
  ["Islam", /muslim|sunni|shia|shi'a|islam|ibadi|alawite|ahmadi|bektashi/i],
  ["Hinduism", /hindu/i],
  ["Buddhism", /buddh/i],
  ["Judaism", /jewish|judaism/i],
  ["Shintoism", /shinto/i],
  ["Sikhism", /sikh/i],
  ["Taoism", /tao/i],
  ["Baha'i", /baha'?i/i],
  ["Druze", /druze/i],
  ["Folk/Indigenous religions", /folk|animis|traditional|indigenous|spiri?tis|spirtism|vodou|voodoo|santeria|african|tribal|rastafari|ethnic religion|umbanda|candombl|winti|badimo|modekngei|shaman|maori|pagan|kirat|customary/i],
];
const NON_RELIGIOUS = "Non-religious";
const MAX_RELIGION_GROUPS = 3;
const LOW_COVERAGE_PCT = 80;
// Below this the shares are too incomplete to show: names only, no percentages
// (so the app also keeps the country out of the Religion quiz).
const MIN_SHARE_COVERAGE_PCT = 60;
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
  return analyzeReligions(raw).groups;
}

// parseReligions plus diagnostics: every labelled share with the broad group
// it mapped to (null if none), and how much of the text's share was mapped.
function analyzeReligions(raw) {
  const text = decodeEntities(raw)
    // Factbook typos: Andorra "89.5," (missing %), DR Congo "93/1%" (for 93.1%).
    .replace(/(predominantly Roman Catholic\)) 89\.5,/, "$1 89.5%,")
    .replace(/(\d+)\/(\d)%/, "$1.$2%").replace(/\((?:[^()]|\([^()]*\))*\)/g, (m) => (/est\.\)$/.test(m) ? "" : " "));
  const parts = text.split(",");
  const totals = new Map();
  const entries = [];
  let mappedPct = 0;
  for (const part of parts) {
    const pct = part.match(/(<)?\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*%/);
    if (!pct) continue;
    const name = part.slice(0, pct.index).trim();
    const group = RELIGION_GROUPS.find(([, re]) => re.test(name))?.[0] || null;
    let value = parseFloat(pct[2]);
    if (pct[3]) value = (value + parseFloat(pct[3])) / 2;
    if (pct[1]) value /= 2;
    entries.push({ label: name, pct: value, group });
    if (!group) continue;
    mappedPct += value;
    totals.set(group, (totals.get(group) || 0) + value);
  }
  if (totals.size) {
    const groups = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_RELIGION_GROUPS)
      .map(([name, pct]) => ({ name, pct: mappedPct < MIN_SHARE_COVERAGE_PCT ? null : Math.round(pct * 10) / 10 }));
    return { groups, entries, mappedPct };
  }
  const named = [];
  for (const part of parts) {
    const group = RELIGION_GROUPS.find(([, re]) => re.test(part))?.[0];
    if (group && !named.includes(group)) named.push(group);
  }
  const groups = named.slice(0, MAX_RELIGION_GROUPS).map((name) => ({ name, pct: null }));
  return { groups, entries, mappedPct };
}

// Prints raw labels that mapped to no group and countries whose mapped shares
// sum to under LOW_COVERAGE_PCT. Labels like "other" or "unspecified" are
// expected to be unmapped, so they are listed separately.
function reportReligionCoverage(rows) {
  const unmapped = new Map();
  const low = [];
  for (const { name, raw } of rows) {
    const { entries, mappedPct } = analyzeReligions(raw);
    for (const e of entries) {
      if (e.group) continue;
      const u = unmapped.get(e.label) || { count: 0, countries: [] };
      u.count++;
      u.countries.push(name);
      unmapped.set(e.label, u);
    }
    if (entries.length && mappedPct < LOW_COVERAGE_PCT) low.push(`${name} (${Math.round(mappedPct * 10) / 10}%)`);
  }
  const isFiller = (l) => /^(other|unspecified|not stated|unknown|none or unspecified|other\/none\/unspecified|)$|^other\b|unspecified|no (response|answer)|not applicable|refused|objected|don't know|undeclared|^believer$/i.test(l.trim());
  const sorted = [...unmapped.entries()].sort((a, b) => b[1].count - a[1].count);
  log(`\nUnmapped religion labels (${sorted.filter(([l]) => !isFiller(l)).length} distinct, excluding generic "other"/"unspecified"):`);
  for (const [label, u] of sorted) {
    if (isFiller(label)) continue;
    log(`  ${JSON.stringify(label)} x${u.count}: ${u.countries.slice(0, 4).join(", ")}${u.countries.length > 4 ? ", …" : ""}`);
  }
  log(`\nCountries with mapped religion shares under ${LOW_COVERAGE_PCT}% (${low.length}):`);
  for (const l of low) log(`  ${l}`);
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
    // Natural Earth draws French Guiana, Svalbard, Bonaire... inside their parent
    // countries; give them shapes of their own (see split-territories.mjs).
    log(`Split territory shapes: ${splitTopology(atlas).join(", ")}`);
    fs.writeFileSync(path.join(STAGING_DIR, "countries-50m-full.json"), JSON.stringify(atlas));
    const { before, after } = simplifyTopology(atlas, ATLAS_KEEP_FRACTION);
    log(`Simplified world-atlas shapes: ${before} -> ${after} points`);
    fs.writeFileSync(path.join(STAGING_DIR, "countries-50m.json"), JSON.stringify(atlas));

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

    // The World Bank and Factbook fold the territories split out of their parent
    // countries' shapes into the parent; these get a dated population and an area
    // from Wikidata instead (see territory-facts.mjs).
    log("Downloading territory population and area from Wikidata…");
    const territoryFacts = await loadTerritoryFacts();

    const countries = [];
    const religionRows = [];
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

      const religionText = profile?.["People and Society"]?.Religions?.text;
      const religions = parseReligions(religionText);
      if (religionText) religionRows.push({ name: c.name, raw: religionText });
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

      const entry = {
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
        sovereign: SOVEREIGN_ALPHA2.has(iso2),
        governmentType,
        religions,
        gdp,
        ...(TERRITORY_PARENTS[iso2] ? { parent: TERRITORY_PARENTS[iso2] } : {}),
      };
      applyTerritoryFacts(entry, territoryFacts);
      countries.push(entry);
    }

    reportReligionCoverage(religionRows);
    if (process.argv.includes("--audit-religion")) {
      log("\n--audit-religion: report only, data/ left unchanged.");
      return;
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
