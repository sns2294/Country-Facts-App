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
import { socialTags } from "./social-tags.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const topojson = require(path.join(ROOT, "vendor/topojson-client.min.js"));
const T = require(path.join(ROOT, "country-text.js"));
// site.config.json: the maps are noindex like every other page until `indexable` is true (then scripts/build-pages.mjs lists them in sitemap.xml).
const SITE_CONFIG = JSON.parse(read("site.config.json"));
const INDEXABLE = SITE_CONFIG.indexable === true;
const BASE_URL = SITE_CONFIG.baseUrl.replace(/\/+$/, "");
const DARK_MODE_KEY = "countryFacts.darkMode".replace("countryFacts.", "countryFactsApp.");

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n) => (Math.round(n * 10) / 10).toString();
const f1x = num;

// ---------- which shapes belong to which country ----------

const countries = JSON.parse(read("data/countries.json"));
const capitals = JSON.parse(read("map-data/capitals.json"));
// (extra labelled points of a region, such as the Gaza Strip, are added once the region is known)
const numericToA3 = new Map(countries.filter((c) => c.numericCode).map((c) => [c.numericCode, c.alpha3Code]));
const a3Info = new Map(countries.map((c) => [c.alpha3Code, c]));

// Small dependencies are drawn in their parent's colour and carry no label of their own.
const PARENT = { ALA: "FIN", FRO: "DNK", GIB: "ESP", GGY: "GBR", JEY: "GBR", IMN: "GBR", HKG: "CHN", MAC: "CHN" };
// Natural Earth draws these pieces separately (Crimea is split out of Russia by scripts/split-territories.mjs).
// Following the site's rules (shape-rules.js): a piece of a UN member state that a breakaway or occupier holds
// is drawn as part of that state (Crimea, Northern Cyprus, Somaliland); Kosovo and Western Sahara have their own cards.
const NAME_OWNER = { Crimea: "UKR", "N. Cyprus": "CYP", "Cyprus U.N. Buffer Zone": "CYP", Akrotiri: "CYP", Dhekelia: "CYP", Kosovo: "UNK", Somaliland: "SOM", "Golan Heights": "SYR", Baikonur: "KAZ", "Siachen Glacier": "XSI", "Réunion": "REU", Mayotte: "MYT" };
const DISPLAY = { UNK: "Kosovo", VAT: "Vatican City", MKD: "North Macedonia", CZE: "Czechia", BIH: "Bosnia and Herzegovina", GBR: "United Kingdom", COD: "DR Congo", COG: "Republic of the Congo", CIV: "Ivory Coast", STP: "São Tomé and Príncipe", CPV: "Cape Verde", SWZ: "Eswatini", GAZ: "Gaza Strip", XKU: "Southern Kurils (disputed)", XSN: "Senkaku/Diaoyu Is. (disputed)", XDK: "Dokdo/Takeshima (disputed)", XPA: "Paracel Is. (disputed)", XSP: "Spratly Is. (disputed)", XSC: "Scarborough Shoal (disputed)", XNV: "Navassa Island (disputed)", XIA: "Isla Aves (disputed)", XMH: "Matthew and Hunter Is. (disputed)", XSE: "Serranilla Bank (disputed)", XBN: "Bajo Nuevo Bank (disputed)" }; // X-codes: marks that are not countries (cannot clash with an alpha-3)
const nameOf = (a3) => R.names?.[a3] || DISPLAY[a3] || T.getBorderDisplayName(a3Info.get(a3).name); // R.names: this region's own label text
const CONTEXT_LABEL_MAX = 15;

// ---------- the regions ----------
// members: the coloured countries. context: grey neighbours that get a muted label where they fit.
// share: a territory drawn in another country's colour. links: extra "touching" pairs (narrow seas) for the colouring.
// micro: tiny countries labelled outside with a pointer line, in the order they are placed (side: which way the label goes).
// Labels of the Caribbean territories: each with its parent in parentheses.
const TERRITORY_NAMES = {
  PRI: "Puerto Rico (United States)", VIR: "U.S. Virgin Islands (United States)", VGB: "British Virgin Islands (United Kingdom)",
  CYM: "Cayman Islands (United Kingdom)", TCA: "Turks and Caicos Islands (United Kingdom)", AIA: "Anguilla (United Kingdom)",
  MSR: "Montserrat (United Kingdom)", GLP: "Guadeloupe (France)", MTQ: "Martinique (France)", MAF: "Saint Martin (France)",
  BLM: "Saint Barthélemy (France)", ABW: "Aruba (Netherlands)", CUW: "Curaçao (Netherlands)", SXM: "Sint Maarten (Netherlands)",
};
// Where each Caribbean territory's dot and pointer line sit (its main town or island centre); the capitals file has sovereign states only.
const TERRITORY_POINTS = {
  PRI: { lat: 18.47, lon: -66.11 }, VIR: { lat: 18.34, lon: -64.93 }, VGB: { lat: 18.43, lon: -64.62 }, CYM: { lat: 19.29, lon: -81.37 },
  TCA: { lat: 21.46, lon: -71.14 }, AIA: { lat: 18.22, lon: -63.06 }, MSR: { lat: 16.74, lon: -62.19 }, GLP: { lat: 16.2, lon: -61.55 },
  MTQ: { lat: 14.65, lon: -61.02 }, ABW: { lat: 12.52, lon: -70.03 }, CUW: { lat: 12.12, lon: -68.93 }, SXM: { lat: 18.03, lon: -63.07 },
  MAF: { lat: 18.08, lon: -63.07 }, BLM: { lat: 17.9, lon: -62.83 },
};
const withNames = (points, names) => Object.fromEntries(Object.entries(points).map(([a, p]) => [a, { ...p, name: names[a] }]));
const REGIONS = {
  europe: {
    name: "Europe",
    members: countries.filter((c) => c.region === "Europe" && (c.sovereign || c.alpha3Code === "UNK") && c.alpha3Code !== "SJM").map((c) => c.alpha3Code),
    extraColoured: ["GRL"], share: { GRL: "DNK", FRO: "DNK" },
    // Territories are labeled "Name (Parent)", as on the other maps. The Faroe Islands are drawn in Denmark's color (they are part of its shape, too
    // small to label in place), so they get a dot in that color and a pointer label. Svalbard lies beyond the top edge of this frame.
    names: { GRL: "Greenland (Kingdom of Denmark)", FRO: "Faroe Islands (Denmark)" },
    extraPoints: { FRO: { name: "Faroe Islands (Denmark)", lat: 62.01, lon: -6.77, gap: 10 } },
    dots: ["FRO"], dotOnly: ["FRO"],
    context: ["TUR", "MAR", "DZA", "TUN", "LBY", "EGY", "SYR", "KAZ", "GEO", "ARM", "AZE", "IRQ", "LBN", "ISR", "JOR"],
    lon0: 10, lat0: 52, frame: { west: -25.5, east: 43, south: 34.2, north: 71.6 },
    links: [["UNK", "SRB"], ["UNK", "ALB"], ["UNK", "MKD"], ["UNK", "MNE"], // Kosovo has no border list
      ["DNK", "SWE"], ["DNK", "NOR"], ["GBR", "FRA"], ["EST", "FIN"], ["ITA", "MLT"], ["ITA", "HRV"], ["GRC", "ITA"],
      ["GBR", "NOR"], ["LVA", "SWE"], ["POL", "SWE"], ["DEU", "SWE"], ["CYP", "GRC"], ["ISL", "GBR"], ["ISL", "NOR"], ["DNK", "ISL"], ["ESP", "ITA"], ["FRA", "ITA"]],
    micro: ["SMR", "MCO", "AND", "VAT", "LUX", "LIE", "MLT", "FRO"], // the only countries (and the Faroe Islands) that get pointer lines
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
    unit: "countries and territories",
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
  "middle-east": {
    name: "the Middle East", slug: "Middle East",
    preciseLabelBoxes: true,
    unit: "countries and territories",
    // Western Asia plus Egypt, which spans Africa and the Middle East (it is on the Africa map too).
    members: ["TUR", "CYP", "SYR", "LBN", "ISR", "PSE", "JOR", "IRQ", "IRN", "KWT", "SAU", "BHR", "QAT", "ARE", "OMN", "YEM", "EGY", "GEO", "ARM", "AZE"],
    extraColoured: [], share: {},
    context: ["GRC", "BGR", "UKR", "RUS", "TKM", "UZB", "AFG", "PAK", "KAZ", "LBY", "SDN", "ERI", "ETH", "DJI", "SOM", "ROU"],
    width: 1650, lon0: 43, lat0: 28, frame: { west: 23.5, east: 63.5, south: 3, north: 43.8 },
    inset: { region: "middle-east-levant", margin: 14, title: "The Levant, enlarged" },
    capSide: { ISR: "l", PSE: "t", JOR: "t" }, // crowded Levant: Jerusalem left of its dot, Ramallah and Amman above
    capFirst: ["PSE", "ISR", "JOR", "LBN"], // ...and named before the country labels are placed
    capitalNames: ["LBN", "PSE"], // these two also get a capital name next to their pointer-line country label
    links: [["CYP", "TUR"], ["CYP", "SYR"], ["CYP", "LBN"], ["CYP", "ISR"], ["CYP", "EGY"], ["EGY", "SAU"], ["EGY", "JOR"], ["BHR", "QAT"], ["BHR", "SAU"], ["BHR", "IRN"],
      ["IRN", "OMN"], ["IRN", "ARE"], ["IRN", "KWT"], ["IRN", "SAU"], ["QAT", "ARE"], ["PSE", "EGY"], ["IRN", "QAT"]],
    micro: ["BHR", "QAT", "KWT", "LBN", "PSE"],
    microFixed: {}, microSide: { LBN: "west", PSE: "west", KWT: "east", QAT: "east", BHR: "east" },
    seas: [
      { t: "Mediterranean Sea", lon: 29.5, lat: 33.6, rot: 0, size: 12, sp: 0.3 },
      { t: "Black Sea", lon: 34.5, lat: 42.6, rot: 0, size: 11, sp: 0.3 },
      { t: "Caspian Sea", lon: 51, lat: 41.2, rot: 0, size: 11, sp: 0.2 },
      { t: "Aegean Sea", lon: 25.2, lat: 38.6, rot: 0, size: 8.5, sp: 0.1 },
      { t: "Red Sea", lon: 37.8, lat: 20.4, rot: 52, size: 11, sp: 0.2 },
      { t: "Persian Gulf", lon: 51.6, lat: 27.4, rot: -36, size: 9, sp: 0.15 },
      { t: "Gulf of Oman", lon: 58.6, lat: 24.9, rot: -42, size: 8.5, sp: 0.1 },
      { t: "Gulf of Aden", lon: 47.3, lat: 12.9, rot: -8, size: 10, sp: 0.15 },
      { t: "Arabian Sea", lon: 61, lat: 17.5, rot: 0, size: 12, sp: 0.25 },
    ],
    lede: "Dots mark capital cities; the smallest states are labeled with a pointer line, and an inset enlarges the Levant.",
    noteExtra: "Drawn in the Lambert azimuthal equal-area projection. Jerusalem's status is disputed: Israel designates it as its capital, while Palestinians claim East Jerusalem as theirs. Borders are the internationally recognized ones: Northern Cyprus is shown as part of Cyprus, the Golan Heights as part of Syria, Abkhazia and South Ossetia as part of Georgia, and Nagorno-Karabakh as part of Azerbaijan. Palestine is the West Bank and Gaza Strip, as on its country page.",
    projectionName: "Lambert azimuthal equal-area",
  },
  "central-asia": {
    name: "Central Asia",
    preciseLabelBoxes: true,
    members: ["KAZ", "UZB", "TKM", "KGZ", "TJK", "AFG"],
    extraColoured: [], share: {},
    context: ["RUS", "CHN", "MNG", "IND", "PAK", "IRN", "AZE", "NPL"],
    width: 1650, lon0: 67, lat0: 43, frame: { west: 46.3, east: 87.8, south: 29.2, north: 56 },
    links: [["KAZ", "TKM"], ["TKM", "KAZ"]],
    micro: [], microFixed: {}, microSide: {},
    seas: [
      { t: "Caspian Sea", lon: 51.3, lat: 41.2, rot: -75, size: 11, sp: 0.2 },
    ],
    lede: "Dots mark capital cities.",
    noteExtra: "Drawn in the Lambert azimuthal equal-area projection. Baikonur, the space launch site Kazakhstan leases to Russia, is shown as part of Kazakhstan. Kashmir and the Siachen Glacier, which India, Pakistan and China all claim in part, are shown in gray as Natural Earth draws them, with no country label.",
    projectionName: "Lambert azimuthal equal-area",
  },
  "south-america": {
    name: "South America",
    preciseLabelBoxes: true,
    members: ["ARG", "BOL", "BRA", "CHL", "COL", "ECU", "GUY", "PRY", "PER", "SUR", "URY", "VEN"],
    // French Guiana (France), the Falkland Islands and South Georgia (United Kingdom) in their parent's color from the Europe map.
    extraColoured: ["GUF", "FLK", "SGS"], share: {},
    fixedColours: { GUF: "FRA", FLK: "GBR", SGS: "GBR" },
    nameOwner: { "French Guiana": "GUF" },
    names: { GUF: "French Guiana (France)", FLK: "Falkland Islands (United Kingdom)", SGS: "South Georgia and the South Sandwich Islands (United Kingdom)" },
    context: ["PAN", "TTO"],
    inset: { region: "south-america-galapagos", margin: 14, title: "Galápagos Islands (Ecuador)" },
    extraPoints: { GUF: { name: "French Guiana (France)", lat: 3.9, lon: -53.2, gap: 6 }, FLK: { name: "Falkland Islands (United Kingdom)", lat: -51.75, lon: -59.0, gap: 8 }, SGS: { name: "South Georgia and the South Sandwich Islands (United Kingdom)", lat: -54.4, lon: -36.6, gap: 8 } },
    width: 1650, lon0: -60, lat0: -17,
    frame: { points: [[-72, 12.6], [-75.6, 11.2], [-79, 1.5], [-81, -2], [-81.3, -5.5], [-79, -33.6], [-75.8, -46], [-75.5, -52.5], [-67.5, -55.9], [-61.5, -52.3], [-57.5, -51.3], [-38.2, -54.2], [-35.7, -55], [-34.8, -7.5], [-32.4, -3.9], [-35, -5], [-60, 9.5], [-57, 6.8], [-61, 10.8], [-60.3, 5.3], [-71.5, 12.2]], margin: 0.03 },
    links: [["FLK", "ARG"], ["FLK", "CHL"], ["GUF", "SUR"], ["GUF", "BRA"]],
    micro: ["GUF", "FLK", "SGS"], microFixed: {}, microSide: { GUF: "east" }, balancedMicroLabels: "only",
    dots: ["FLK", "SGS"],
    seas: [
      { t: "Pacific Ocean", lon: -79.2, lat: -29, rot: -86, size: 12, sp: 0.3 },
      { t: "Atlantic Ocean", lon: -37, lat: -30, rot: -65, size: 14, sp: 0.35 },
      { t: "Caribbean Sea", lon: -73.5, lat: 12.9, rot: 0, size: 8, sp: 0.18 },
      { t: "Drake Passage", lon: -66.5, lat: -57.3, rot: 0, size: 7, sp: 0.12 },
    ],
    lede: "Dots mark capital cities. French Guiana, the Falkland Islands and South Georgia are in their parent country's color, with the parent in parentheses; an inset shows the Galápagos Islands.",
    noteExtra: "Drawn in the Lambert azimuthal equal-area projection. French Guiana is an overseas department of France; the Falkland Islands and South Georgia and the South Sandwich Islands are British Overseas Territories, and Argentina claims them. Venezuela claims Guyana's Essequibo region, about two-thirds of Guyana; the map shows the internationally recognized border, and the dispute is pending before the International Court of Justice. Sucre is Bolivia's constitutional capital; La Paz is its seat of government.",
    projectionName: "Lambert azimuthal equal-area",
  },
  // Not a page: the Galápagos inset of the South America map (same code, its own projection, the main map's colors).
  "south-america-galapagos": {
    fragment: true,
    name: "the Galápagos",
    members: ["ECU"],
    extraColoured: [], share: {}, context: [],
    names: { ECU: "Galápagos Islands (Ecuador)" },
    extraPoints: { ECU: { name: "Galápagos Islands (Ecuador)", lat: -0.55, lon: -91.0, gap: 10 } },
    micro: ["ECU"], microSide: { ECU: "south" },
    preciseLabelBoxes: true,
    width: 300, lon0: -90.6, lat0: 0.1, frame: { west: -92.4, east: -88.8, south: -1.7, north: 2.0 },
    links: [], microFixed: {},
    seas: [],
  },
  "central-america-caribbean": {
    name: "Central America and the Caribbean",
    preciseLabelBoxes: true,
    members: ["MEX", "GTM", "BLZ", "HND", "SLV", "NIC", "CRI", "PAN", "CUB", "JAM", "HTI", "DOM", "BHS", "ATG", "KNA", "DMA", "LCA", "VCT", "GRD", "BRB", "TTO"],
    // Territories are drawn in their parent's colour (the United States' from the North America map, the others' from the Europe
    // map), with the parent in parentheses. Natural Earth's shapes for these are named, not numbered, so they are claimed here.
    extraColoured: ["PRI", "VIR", "MAF", "GLP", "MTQ", "BLM", "VGB", "CYM", "TCA", "AIA", "MSR", "ABW", "CUW", "BES", "SXM"], share: {},
    fixedColours: {
      PRI: ["north-america", "USA"], VIR: ["north-america", "USA"],
      MAF: "FRA", GLP: "FRA", MTQ: "FRA", BLM: "FRA",
      VGB: "GBR", CYM: "GBR", TCA: "GBR", AIA: "GBR", MSR: "GBR",
      ABW: "NLD", CUW: "NLD", BES: "NLD", SXM: "NLD",
    },
    nameOwner: { Guadeloupe: "GLP", Martinique: "MTQ", "Bonaire, Sint Eustatius and Saba": "BES", "USNB Guantanamo Bay": "CUB" }, // Guantanamo Bay is leased, not ceded: part of Cuba
    names: { ...TERRITORY_NAMES, BES: "Bonaire (Netherlands)" },
    context: ["USA", "COL", "VEN", "GUY", "SUR"],
    disputed: [
      { group: "navassa", marker: true }, { group: "birdisland", marker: true }, { group: "serranilla", marker: true }, { group: "bajonuevo", marker: true },
    ],
    extraPoints: {
      ...withNames(TERRITORY_POINTS, TERRITORY_NAMES),
      BES: { name: "Bonaire (Netherlands)", lat: 12.15, lon: -68.27 },
      XNV: { name: "Navassa Island (disputed)", lat: 18.41, lon: -75.01, gap: 12 }, XIA: { name: "Isla Aves (disputed)", lat: 15.69, lon: -63.64, gap: 12 },
      XSE: { name: "Serranilla Bank (disputed)", lat: 15.82, lon: -79.85, gap: 12 }, XBN: { name: "Bajo Nuevo Bank (disputed)", lat: 15.87, lon: -78.64, gap: 12 },
    },
    inset: { region: "central-america-caribbean-lesser-antilles", margin: 14, title: "The Lesser Antilles, enlarged", corner: "top-right" },
    width: 1650, lon0: -77, lat0: 17,
    frame: { points: [[-98, 17], [-98, 28.5], [-80, 41.5], [-54.5, 41.5], [-54.5, 10], [-60, 6.8], [-78, 6.5], [-86, 7.5], [-95, 13.5]], margin: 0.02 },
    links: [
      ["CUB", "BHS"], ["CUB", "HTI"], ["CUB", "JAM"], ["CUB", "CYM"], ["CUB", "MEX"], ["JAM", "HTI"], ["JAM", "CYM"], ["HTI", "BHS"], ["HTI", "TCA"], ["DOM", "TCA"],
      ["BHS", "TCA"], ["DOM", "PRI"], ["PRI", "VGB"], ["VIR", "VGB"], ["AIA", "SXM"], ["AIA", "MAF"], ["SXM", "MAF"], ["MAF", "BES"], ["BLM", "SXM"],
      ["BLM", "BES"], ["BLM", "KNA"], ["BES", "KNA"], ["KNA", "MSR"], ["KNA", "ATG"], ["MSR", "ATG"], ["MSR", "GLP"], ["ATG", "GLP"], ["GLP", "DMA"], ["DMA", "MTQ"],
      ["MTQ", "LCA"], ["LCA", "VCT"], ["VCT", "GRD"], ["GRD", "TTO"], ["BRB", "LCA"], ["BRB", "VCT"], ["CUW", "VEN"], ["HND", "CYM"],
    ],
    micro: ["SLV", "CYM", "TCA", "ABW", "CUW", "BES", "PRI", "XNV", "XIA", "XSE", "XBN"], microFixed: {}, microSide: {}, balancedMicroLabels: true,
    dots: ["CYM", "TCA", "ABW", "CUW", "BES", "AIA", "MSR", "BLM", "SXM", "MAF", "VGB"],
    unlabelled: ["ATG", "KNA", "DMA", "LCA", "VCT", "GRD", "BRB", "TTO", "GLP", "MTQ", "VIR", "VGB", "MSR", "AIA", "SXM", "MAF", "BLM"], // named in the inset instead
    seas: [
      { t: "Caribbean Sea", lon: -75.5, lat: 14.6, rot: 0, size: 13, sp: 0.3 },
      { t: "Gulf of Mexico", lon: -90, lat: 25.3, rot: 0, size: 11, sp: 0.25 },
      { t: "Atlantic Ocean", lon: -71, lat: 31, rot: 0, size: 13, sp: 0.3 },
      { t: "Pacific Ocean", lon: -93.5, lat: 9.6, rot: -30, size: 12, sp: 0.3 },
      { t: "Gulf of Honduras", lon: -87.6, lat: 16.2, rot: 0, size: 6.5, sp: 0.1 },
      { t: "Straits of Florida", lon: -80, lat: 24, rot: -20, size: 6, sp: 0.08 },
      { t: "Windward Passage", lon: -74.1, lat: 19.9, rot: -45, size: 6, sp: 0.08 },
      { t: "Gulf of Tehuantepec", lon: -95, lat: 15.1, rot: 0, size: 6.5, sp: 0.1 },
      { t: "Bay of Campeche", lon: -93.5, lat: 19.9, rot: 0, size: 6.5, sp: 0.1 },
    ],
    lede: "Dots mark capital cities. Territories are in their parent country's color, with the parent in parentheses; an inset enlarges the Lesser Antilles.",
    noteExtra: "Drawn in the Lambert azimuthal equal-area projection. Belize's border with Guatemala is the internationally recognized line; Guatemala claims part of Belize, and the dispute is pending before the International Court of Justice. Areas claimed by more than one country are given to none and marked, not to scale: Navassa Island (administered by the United States, claimed by Haiti), Isla Aves (administered by Venezuela, claimed by others) and the Serranilla and Bajo Nuevo banks (administered by Colombia, claimed by several countries). Guantánamo Bay, which the United States leases from Cuba, is shown as part of Cuba. The Dutch territories are not in the Netherlands' Europe-map color, because Sint Maarten shares an island with French Saint Martin.",
    projectionName: "Lambert azimuthal equal-area",
  },
  // Not a page: the Lesser Antilles inset of the Central America and Caribbean map (same code, its own projection, the main map's colors).
  "central-america-caribbean-lesser-antilles": {
    fragment: true,
    name: "the Lesser Antilles",
    members: ["ATG", "KNA", "DMA", "LCA", "VCT", "GRD", "BRB", "TTO"],
    extraColoured: ["PRI", "VIR", "MAF", "GLP", "MTQ", "BLM", "VGB", "AIA", "MSR", "BES", "SXM"], share: {}, context: [],
    nameOwner: { Guadeloupe: "GLP", Martinique: "MTQ", "Bonaire, Sint Eustatius and Saba": "BES" },
    names: { ...TERRITORY_NAMES, BES: "Sint Eustatius and Saba (Netherlands)" },
    extraPoints: { ...withNames(TERRITORY_POINTS, TERRITORY_NAMES), BES: { name: "Sint Eustatius and Saba (Netherlands)", lat: 17.49, lon: -62.97 } },
    preciseLabelBoxes: true, balancedMicroLabels: "only",
    micro: ["VGB", "VIR", "PRI", "AIA", "MAF", "SXM", "BLM", "BES", "KNA", "MSR", "ATG", "GLP", "DMA", "MTQ", "LCA", "VCT", "GRD", "BRB", "TTO"], microFixed: {}, microSide: { PRI: "south", VGB: "north" }, microPad: 5,
    dots: ["VIR", "VGB", "AIA", "SXM", "MAF", "BLM", "BES", "MSR"],
    width: 520, lon0: -62.5, lat0: 14.4, frame: { west: -65.9, east: -59.1, south: 9.7, north: 19.1 },
    links: [],
    seas: [
      { t: "Caribbean Sea", lon: -64.9, lat: 12.9, rot: 0, size: 9, sp: 0.2 },
      { t: "Atlantic Ocean", lon: -59.6, lat: 16.3, rot: -80, size: 9, sp: 0.2 },
    ],
  },
  "north-america": {
    name: "North America",
    preciseLabelBoxes: true,
    members: ["CAN", "USA", "MEX"],
    // Greenland (Kingdom of Denmark), Bermuda (UK) and Saint Pierre and Miquelon (France) are drawn in their parents' colors from the Europe map.
    extraColoured: ["GRL", "BMU", "SPM"], share: {},
    fixedColours: { GRL: "DNK", BMU: "GBR", SPM: "FRA" },
    names: { GRL: "Greenland (Kingdom of Denmark)", BMU: "Bermuda (United Kingdom)", SPM: "Saint Pierre and Miquelon (France)" },
    parent: { PRI: "USA", VIR: "USA" },
    context: ["RUS", "CUB", "BHS", "JAM", "HTI", "DOM", "BLZ", "GTM", "HND", "SLV", "NIC", "ISL"],
    inset: { region: "north-america-hawaii", margin: 14, title: "Hawaii (United States)" },
    extraPoints: { BMU: { name: "Bermuda (United Kingdom)", lat: 32.31, lon: -64.75, gap: 12 }, SPM: { name: "Saint Pierre and Miquelon (France)", lat: 46.9, lon: -56.3, gap: 12 } },
    width: 1650, lon0: -97, lat0: 52,
    // Framed by Alaska's western tip and the Aleutians, Greenland's north and north-east, Ellesmere Island, Mexico's south,
    // Florida, Newfoundland, Bermuda and a little of the Caribbean and Central America.
    frame: { points: [[-170, 66], [-172, 53], [-165, 54], [-12, 81.5], [-30, 83.6], [-70, 83.2], [-125, 76], [-92, 14.3], [-84, 15], [-72, 18.3], [-80, 24.5], [-64, 32.5], [-52.5, 47.5], [-55, 52], [-115, 23], [-110, 23], [-95, 15]], margin: 0.03 },
    links: [["GRL", "CAN"], ["SPM", "CAN"], ["USA", "CAN"], ["USA", "MEX"]],
    micro: ["BMU", "SPM"], microFixed: {}, microSide: { BMU: "east" }, balancedMicroLabels: true,
    dots: ["BMU", "SPM"], // tiny territories get a small dot in their color (too small to see otherwise)
    seas: [
      { t: "Pacific Ocean", lon: -136, lat: 30, rot: 0, size: 16, sp: 0.35 },
      { t: "Atlantic Ocean", lon: -44, lat: 36, rot: -45, size: 16, sp: 0.35 },
      { t: "Arctic Ocean", lon: -150, lat: 79, rot: 0, size: 12, sp: 0.3 },
      { t: "Beaufort Sea", lon: -138, lat: 71.4, rot: -10, size: 8.5, sp: 0.15 },
      { t: "Gulf of Mexico", lon: -90, lat: 25.3, rot: 0, size: 10, sp: 0.2 },
      { t: "Caribbean Sea", lon: -78, lat: 14.8, rot: 0, size: 9, sp: 0.2 },
      { t: "Hudson Bay", lon: -85, lat: 59.5, rot: 0, size: 10, sp: 0.2 },
      { t: "Baffin Bay", lon: -66, lat: 72, rot: -60, size: 9, sp: 0.2 },
      { t: "Labrador Sea", lon: -52, lat: 57, rot: -40, size: 8, sp: 0.15 },
      { t: "Davis Strait", lon: -58.5, lat: 65.5, rot: -50, size: 6.5, sp: 0.1 },
      { t: "Gulf of Alaska", lon: -146, lat: 57, rot: 0, size: 8.5, sp: 0.15 },
      { t: "Bering Sea", lon: -171, lat: 60.5, rot: -60, size: 8.5, sp: 0.15 },
      { t: "Greenland Sea", lon: -14, lat: 75, rot: 70, size: 8, sp: 0.15 },
      { t: "Denmark Strait", lon: -28, lat: 66.3, rot: -45, size: 6.5, sp: 0.1 },
    ],
    lede: "Dots mark capital cities; Greenland, Bermuda and Saint Pierre and Miquelon are shown in their parent country's color, and an inset enlarges Hawaii.",
    noteExtra: "Drawn in the Lambert azimuthal equal-area projection. Greenland is part of the Kingdom of Denmark, Bermuda is a British Overseas Territory and Saint Pierre and Miquelon is a French overseas collectivity; each is in its parent's color from the Europe map. Puerto Rico and the U.S. Virgin Islands are shown in the United States' color. The western Aleutian Islands lie beyond the left edge.",
    projectionName: "Lambert azimuthal equal-area",
  },
  // Not a page: the Hawaii inset of the North America map (same code, its own projection, the main map's colors).
  "north-america-hawaii": {
    fragment: true,
    name: "Hawaii",
    members: ["USA"],
    extraColoured: [], share: {}, context: [],
    names: { USA: "Hawaii" },
    extraPoints: { USA: { name: "Honolulu", lat: 21.31, lon: -157.86 } },
    preciseLabelBoxes: true,
    width: 270, lon0: -157.6, lat0: 20.6, frame: { west: -160.7, east: -154.6, south: 18.8, north: 22.4 },
    links: [], micro: [], microFixed: {}, microSide: {},
    seas: [],
  },
  "southeast-asia": {
    name: "Southeast Asia",
    preciseLabelBoxes: true,
    members: ["MMR", "THA", "LAO", "KHM", "VNM", "MYS", "SGP", "BRN", "IDN", "PHL", "TLS"],
    extraColoured: [], share: {},
    context: ["CHN", "IND", "BGD", "TWN", "PNG", "AUS"],
    // Scattered islands in the South China Sea that several countries claim are given to none: an oval over the area they lie in.
    disputed: [
      { group: "paracels", marker: true, ring: true },
      { group: "spratlys", marker: true, ring: true },
      { group: "scarborough", marker: true },
    ],
    extraPoints: {
      XPA: { name: "Paracel Is. (disputed)", lat: 16.4, lon: 112.0, gap: 28 },
      XSP: { name: "Spratly Is. (disputed)", lat: 9.7, lon: 114.6, gap: 56 },
      XSC: { name: "Scarborough Shoal (disputed)", lat: 15.15, lon: 117.76, gap: 12 },
    },
    width: 1650, lon0: 117, lat0: 6, frame: { west: 91.5, east: 141.5, south: -11.5, north: 28.8 },
    links: [["SGP", "MYS"], ["SGP", "IDN"], ["PHL", "MYS"], ["PHL", "IDN"], ["MYS", "VNM"], ["THA", "VNM"], ["BRN", "PHL"], ["KHM", "MYS"]],
    micro: ["SGP", "BRN", "TLS", "XPA", "XSP", "XSC"], microFixed: {}, microSide: { XPA: "west", XSP: "east", TLS: "south" },
    seas: [
      { t: "South China Sea", lon: 112.4, lat: 12.6, rot: -35, size: 11, sp: 0.25 },
      { t: "Gulf of Thailand", lon: 101.4, lat: 9.2, rot: 0, size: 7, sp: 0.1 },
      { t: "Andaman Sea", lon: 95.4, lat: 11.5, rot: -75, size: 8.5, sp: 0.15 },
      { t: "Bay of Bengal", lon: 92.8, lat: 17, rot: -60, size: 8.5, sp: 0.2 },
      { t: "Java Sea", lon: 111.5, lat: -5.4, rot: 0, size: 9, sp: 0.2 },
      { t: "Celebes Sea", lon: 122.6, lat: 3.7, rot: 0, size: 8, sp: 0.15 },
      { t: "Sulu Sea", lon: 119.6, lat: 8.6, rot: -40, size: 7.5, sp: 0.15 },
      { t: "Philippine Sea", lon: 130, lat: 14.5, rot: 0, size: 11, sp: 0.25 },
      { t: "Banda Sea", lon: 127, lat: -5.6, rot: 0, size: 9, sp: 0.2 },
      { t: "Indian Ocean", lon: 100, lat: -8.4, rot: -20, size: 12, sp: 0.3 },
      { t: "Pacific Ocean", lon: 137, lat: 6, rot: -80, size: 13, sp: 0.35 },
      { t: "Timor Sea", lon: 127.5, lat: -10.6, rot: 0, size: 7.5, sp: 0.15 },
    ],
    lede: "Dots mark capital cities; the smallest states are labeled with a pointer line.",
    noteExtra: "Drawn in the Lambert azimuthal equal-area projection. The Paracel Islands (administered by China, claimed by Vietnam and Taiwan), the Spratly Islands (claimed in whole or part by China, Taiwan, Vietnam, the Philippines, Malaysia and Brunei) and Scarborough Shoal (claimed by China, the Philippines and Taiwan) are given to none and shown hatched: the ovals mark the area the scattered islands lie in, not claimed waters. Sabah is shown as part of Malaysia; the Philippines also claims it.",
    projectionName: "Lambert azimuthal equal-area",
  },
  "east-asia": {
    name: "East Asia",
    preciseLabelBoxes: true,
    // Taiwan is its own entry and shape on the site, so it has its own color and label here; Hong Kong and Macao take China's.
    members: ["CHN", "MNG", "JPN", "PRK", "KOR", "TWN"],
    extraColoured: [], share: {},
    context: ["RUS", "KAZ", "KGZ", "TJK", "AFG", "PAK", "IND", "NPL", "BTN", "MMR", "LAO", "VNM", "PHL"],
    // Areas claimed by more than one country are given to none (the site's rule for unsettled disputes): hatched. The
    // Senkaku / Diaoyu Islands and Dokdo / Takeshima are too small to draw to scale, so they are marks.
    disputed: [
      { group: "kashmir", label: "Kashmir (disputed)" },
      { group: "kurils" },
      { group: "senkaku", marker: true },
      { group: "dokdo", marker: true },
    ],
    extraPoints: { XKU: { name: "Southern Kurils (disputed)", lat: 44.5, lon: 146.7, gap: 22 }, XSN: { name: "Senkaku/Diaoyu Is. (disputed)", lat: 25.8, lon: 124.0, gap: 12 }, XDK: { name: "Dokdo/Takeshima (disputed)", lat: 37.24, lon: 131.86, gap: 12 } },
    width: 1650, lon0: 106, lat0: 36, frame: { west: 73, east: 149.5, south: 17.2, north: 54.5 },
    links: [["JPN", "KOR"], ["JPN", "PRK"], ["JPN", "CHN"], ["TWN", "CHN"], ["TWN", "JPN"], ["KOR", "CHN"]],
    micro: ["XKU", "XSN", "XDK"], microFixed: {}, microSide: {},
    seas: [
      { t: "Sea of Japan (East Sea)", lon: 134.5, lat: 40.6, rot: -42, size: 9, sp: 0.15 },
      { t: "Yellow Sea", lon: 123.2, lat: 35.7, rot: -80, size: 8.5, sp: 0.15 },
      { t: "East China Sea", lon: 125.8, lat: 29.5, rot: -40, size: 10, sp: 0.2 },
      { t: "South China Sea", lon: 113.5, lat: 19.2, rot: 0, size: 11, sp: 0.25 },
      { t: "Philippine Sea", lon: 137.5, lat: 23.2, rot: 0, size: 11, sp: 0.25 },
      { t: "Pacific Ocean", lon: 145.5, lat: 33, rot: -80, size: 14, sp: 0.35 },
      { t: "Sea of Okhotsk", lon: 146.5, lat: 51.5, rot: 0, size: 9, sp: 0.2 },
      { t: "Bohai Sea", lon: 119.6, lat: 38.4, rot: 0, size: 6.5, sp: 0.1 },
    ],
    lede: "Dots mark capital cities.",
    noteExtra: "Drawn in the Lambert azimuthal equal-area projection. Taiwan is shown as its own entry, as on the site; Hong Kong and Macao take China's color. Areas claimed by more than one country are given to none and hatched: Kashmir (including Aksai Chin), the Southern Kuril Islands (administered by Russia, claimed by Japan), the Senkaku/Diaoyu Islands (administered by Japan, claimed by China and Taiwan) and Dokdo/Takeshima (administered by South Korea, claimed by Japan); the last two are marks, not to scale. The South China Sea islands lie outside this map.",
    projectionName: "Lambert azimuthal equal-area",
  },
  "south-asia": {
    name: "South Asia",
    preciseLabelBoxes: true,
    members: ["IND", "PAK", "BGD", "LKA", "NPL", "BTN", "MDV"],
    extraColoured: [], share: {},
    context: ["AFG", "IRN", "CHN", "MMR", "TJK", "OMN"],
    // Kashmir is not given to any country: hatched, with dashed lines at the lines of control (the site's rule for unsettled disputes).
    disputed: [{ group: "kashmir", label: "Kashmir (disputed)" }],
    width: 1650, lon0: 79, lat0: 18, frame: { west: 59.5, east: 98.5, south: -1.2, north: 37.4 },
    links: [["NPL", "BTN"], ["BGD", "NPL"], ["BGD", "BTN"], ["LKA", "IND"], ["MDV", "LKA"], ["MDV", "IND"]],
    micro: ["MDV"], microFixed: {}, microSide: {},
    seas: [
      { t: "Arabian Sea", lon: 66.5, lat: 14.5, rot: 0, size: 13, sp: 0.28 },
      { t: "Bay of Bengal", lon: 87.8, lat: 14.5, rot: 0, size: 13, sp: 0.28 },
      { t: "Indian Ocean", lon: 79.5, lat: 0.6, rot: 0, size: 14, sp: 0.35 },
      { t: "Laccadive Sea", lon: 74.6, lat: 8.7, rot: -20, size: 8, sp: 0.15 },
      { t: "Andaman Sea", lon: 95.6, lat: 11, rot: -62, size: 8.5, sp: 0.15 },
    ],
    lede: "Dots mark capital cities; the smallest state is labeled with a pointer line.",
    noteExtra: "Drawn in the Lambert azimuthal equal-area projection. Kashmir is disputed: India and Pakistan each administer part of it and claim all of it, and China administers Aksai Chin and the Shaksgam Valley, which India claims. The map assigns none of it to a country; it is hatched, with dashed lines where the administered parts meet. The Siachen Glacier is shown the same way.",
    projectionName: "Lambert azimuthal equal-area",
  },
  // Not a page: the Levant inset of the Middle East map, drawn by the same code with its own projection, then embedded
  // in that map (colors come from the main map so every country keeps its color).
  "middle-east-levant": {
    fragment: true,
    name: "the Levant",
    members: ["ISR", "PSE", "LBN", "SYR", "JOR", "EGY", "SAU"],
    extraColoured: [], share: {}, context: [],
    golan: true, // label the Golan Heights (part of Syria) and mark it with a dashed outline
    extraPoints: { GAZ: { name: "Gaza Strip", lat: 31.42, lon: 34.37 } },
    preciseLabelBoxes: true,
    width: 440, lon0: 35.5, lat0: 31.8, frame: { west: 33.5, east: 37.3, south: 29.1, north: 34.3 },
    links: [],
    micro: ["GAZ"], microFixed: {}, microSide: { GAZ: "west" },
    seas: [
      { t: "Mediterranean Sea", lon: 33.9, lat: 33.1, rot: -72, size: 10, sp: 0.2 },
      { t: "Gulf of Aqaba", lon: 34.95, lat: 28.9, rot: 62, size: 7, sp: 0.1 },
    ],
  },
  oceania: {
    name: "Oceania",
    preciseLabelBoxes: true,
    members: ["AUS", "NZL", "PNG", "FJI", "SLB", "VUT", "WSM", "TON", "KIR", "TUV", "NRU", "MHL", "FSM", "PLW"],
    // Territories are drawn in their parent's colour (France's, the United Kingdom's and the United States' from the Europe and
    // North America maps; Australia's and New Zealand's from this map, through R.share), with the parent in parentheses.
    // Hawaii (a state) is in the frame because the Mariana and Line Islands put it there. many territory shapes are too small to see (and Tokelau's Nukunonu is missing from the data): each territory also gets a dot in its color.
    extraColoured: ["NCL", "PYF", "WLF", "PCN", "GUM", "ASM", "MNP", "UMI", "USA", "COK", "NIU", "TKL", "NFK"],
    share: { COK: "NZL", NIU: "NZL", TKL: "NZL", NFK: "AUS" },
    fixedColours: { NCL: "FRA", PYF: "FRA", WLF: "FRA", PCN: "GBR", GUM: ["north-america", "USA"], ASM: ["north-america", "USA"], MNP: ["north-america", "USA"], UMI: ["north-america", "USA"], USA: ["north-america", "USA"] },
    nameOwner: { "Coral Sea Is.": "AUS" },
    names: {
      NCL: "New Caledonia (France)", PYF: "French Polynesia (France)", WLF: "Wallis and Futuna (France)", PCN: "Pitcairn Islands (United Kingdom)",
      GUM: "Guam (United States)", ASM: "American Samoa (United States)", MNP: "Northern Mariana Islands (United States)",
      UMI: "U.S. Minor Outlying Islands (United States)", USA: "Hawaii (United States)",
      COK: "Cook Islands (New Zealand)", NIU: "Niue (New Zealand)", TKL: "Tokelau (New Zealand)", NFK: "Norfolk Island (Australia)",
    },
    extraPoints: {
      NCL: { name: "New Caledonia (France)", lat: -21.3, lon: 165.6, gap: 14 }, PYF: { name: "French Polynesia (France)", lat: -17.535, lon: -149.57, gap: 14 },
      WLF: { name: "Wallis and Futuna (France)", lat: -13.28, lon: -176.17, gap: 14 }, PCN: { name: "Pitcairn Islands (United Kingdom)", lat: -25.066, lon: -130.1, gap: 14 },
      GUM: { name: "Guam (United States)", lat: 13.45, lon: 144.78, gap: 14 }, ASM: { name: "American Samoa (United States)", lat: -14.27, lon: -170.7, gap: 14 },
      MNP: { name: "Northern Mariana Islands (United States)", lat: 15.19, lon: 145.75, gap: 14 }, UMI: { name: "U.S. Minor Outlying Islands (United States)", lat: 5.88, lon: -162.08, gap: 14 },
      USA: { name: "Hawaii (United States)", lat: 20.5, lon: -157.0, gap: 14 },
      XMH: { name: "Matthew and Hunter Is. (disputed)", lat: -22.37, lon: 171.68, gap: 14 },
      COK: { name: "Cook Islands (New Zealand)", lat: -21.2, lon: -159.78, gap: 14 }, NIU: { name: "Niue (New Zealand)", lat: -19.05, lon: -169.87, gap: 14 },
      TKL: { name: "Tokelau (New Zealand)", lat: -9.17, lon: -171.85, gap: 14 }, NFK: { name: "Norfolk Island (Australia)", lat: -29.04, lon: 167.95, gap: 14 },
    },
    context: ["IDN", "PHL", "TLS", "MYS"],
    // Fiji, an independent country, takes the one palette colour (5) that no country or territory parent on this map uses, so it cannot be mistaken for a territory of Australia.
    colourOverride: { FJI: 5 },
    // Matthew and Hunter Islands (administered by France, claimed by Vanuatu) are given to neither: Natural Earth draws Matthew Island
    // inside New Caledonia, so it is cut out, and one hatched oval marks both islands (Hunter is not in the data). Not to scale.
    carve: [{ from: "NCL", box: [171.1, 171.6, -22.5, -22.2], what: "Matthew Island" }],
    disputed: [{ group: "matthew-hunter", marker: true, ring: true, at: [[171.32, -22.33], [172.05, -22.4]] }],
    capitalNames: ["NZL"], // New Zealand's capital is named beside its pointer-line label, as Canberra and Port Moresby are
    minRing: 0.0005, // keep the atolls (all of Tuvalu's nine, the Marshall and Gilbert Islands) as specks
    width: 1650, lon0: 174.5, lat0: -13,
    // Framed by Australia's west and south, Tasmania, New Zealand's south, Pitcairn, Hawaii, the Marianas and Palau.
    frame: { points: [[113.0, -26.5], [113.4, -21.7], [114.5, -34.4], [146.4, -43.7], [166.5, -46.8], [167.6, -47.4], [179, -47.9], [-176.3, -44.6], [-123.6, -25.4], [-123.6, -22], [-134, -9], [-154.6, 18.8], [-154.6, 22.4], [-160.6, 22.4], [145.9, 20.7], [135, 8.6], [130.8, 3], [125, 6.5]], margin: 0.025 },
    links: [
      ["AUS", "PNG"], ["AUS", "NZL"], ["AUS", "VUT"], ["AUS", "NCL"], ["AUS", "SLB"], ["PNG", "SLB"], ["PNG", "FSM"], ["PNG", "PLW"], ["PNG", "NRU"],
      ["SLB", "VUT"], ["SLB", "NRU"], ["SLB", "KIR"], ["SLB", "NCL"], ["VUT", "NCL"], ["VUT", "FJI"], ["NCL", "FJI"], ["NCL", "NZL"], ["NZL", "FJI"], ["NZL", "TON"],
      ["FJI", "TON"], ["FJI", "WLF"], ["FJI", "TUV"], ["FJI", "WSM"], ["WLF", "WSM"], ["WLF", "TON"], ["WLF", "TUV"],
      ["WSM", "ASM"], ["WSM", "TON"], ["WSM", "TKL"], ["WSM", "NIU"], ["ASM", "TON"], ["ASM", "NIU"], ["ASM", "TKL"], ["ASM", "COK"], ["TON", "NIU"],
      ["TUV", "KIR"], ["TUV", "TKL"], ["TUV", "NRU"], ["KIR", "NRU"], ["KIR", "MHL"], ["KIR", "TKL"], ["KIR", "COK"], ["KIR", "UMI"], ["KIR", "ASM"], ["KIR", "USA"],
      ["NRU", "MHL"], ["NRU", "FSM"], ["MHL", "FSM"], ["MHL", "UMI"], ["MHL", "GUM"], ["FSM", "PLW"], ["FSM", "GUM"], ["FSM", "MNP"], ["PLW", "GUM"],
      ["NIU", "COK"], ["COK", "PYF"], ["COK", "TKL"], ["PYF", "PCN"], ["UMI", "TKL"], ["NFK", "NCL"], ["NFK", "NZL"], ["NFK", "VUT"],
    ],
    micro: ["KIR", "TUV", "NRU", "MHL", "FSM", "PLW", "GUM", "MNP", "WSM", "ASM", "TON", "NIU", "COK", "TKL", "WLF", "FJI", "VUT", "SLB", "NCL", "XMH", "NFK", "PYF", "PCN", "USA", "UMI", "NZL"],
    microFixed: {}, microSide: { XMH: "south" }, balancedMicroLabels: true,
    dots: ["NCL", "PYF", "WLF", "PCN", "GUM", "ASM", "MNP", "UMI", "USA", "COK", "NIU", "TKL", "NFK"], dotOnly: ["NCL", "PYF", "WLF", "PCN", "GUM", "ASM", "MNP", "UMI", "USA", "COK", "NIU", "TKL", "NFK"], // (the shapes of most are too small to see; Tokelau's Nukunonu is not in the data)
    seas: [
      { t: "North Pacific Ocean", lon: -178, lat: 17, rot: 0, size: 15, sp: 0.3 },
      { t: "South Pacific Ocean", lon: -150, lat: -34, rot: 0, size: 15, sp: 0.3 },
      { t: "Philippine Sea", lon: 136, lat: 17, rot: 0, size: 10, sp: 0.2 },
      { t: "Coral Sea", lon: 154.5, lat: -17, rot: 0, size: 10, sp: 0.2 },
      { t: "Tasman Sea", lon: 160, lat: -38, rot: -20, size: 10, sp: 0.2 },
      { t: "Arafura Sea", lon: 135, lat: -9.2, rot: 0, size: 8, sp: 0.15 },
      { t: "Timor Sea", lon: 126, lat: -12.2, rot: 0, size: 8, sp: 0.15 },
      { t: "Solomon Sea", lon: 153, lat: -7.6, rot: 0, size: 7.5, sp: 0.1 },
      { t: "Bismarck Sea", lon: 148, lat: -3.3, rot: 0, size: 7, sp: 0.1 },
      { t: "Indian Ocean", lon: 113, lat: -24, rot: -80, size: 11, sp: 0.3 },
      { t: "Great Australian Bight", lon: 130, lat: -35.6, rot: 0, size: 8, sp: 0.15 },
          ],
    lede: "Dots mark capital cities. Territories are in their parent country's color, with the parent in parentheses; the small island states and territories are labeled with a pointer line.",
    noteExtra: "Drawn in the Lambert azimuthal equal-area projection, centered on the Pacific so that nothing is split at the 180° line. Hawaii, a U.S. state, is shown because it falls in the frame. The U.S. Minor Outlying Islands are a scattering of small, mostly uninhabited islands and reefs (Wake Island, Johnston Atoll, Palmyra Atoll, Kingman Reef, Jarvis, Baker and Howland); they are in the United States' color but too small to see, and one label stands for them all, at Palmyra. Tokelau is in New Zealand's color: the map data draws two of its three atolls (Fakaofo and Atafu) as part of New Zealand's shape, and the dot marks the third, Nukunonu, which it lacks. Matthew and Hunter Islands are administered by France and claimed by Vanuatu. The Minerva Reefs are claimed by both Tonga and Fiji. The map assigns none of them to a country: Matthew and Hunter are shown as one hatched mark, not to scale, with Matthew Island cut out of New Caledonia's shape, and the Minerva Reefs, which are not in the map data, are not drawn. The Coral Sea Islands and the Ashmore and Cartier Islands are in Australia's color but too small to see. New Zealand's subantarctic islands and Australia's Macquarie Island lie beyond the bottom edge, and Christmas Island and the Cocos (Keeling) Islands beyond the left edge.",
    projectionName: "Lambert azimuthal equal-area",
  },
};

const REGION_ID = process.argv[2];
if (!REGION_ID) {
  const { execFileSync } = await import("node:child_process");
  for (const id of Object.keys(REGIONS).filter((r) => !REGIONS[r].fragment)) execFileSync(process.execPath, [fileURLToPath(import.meta.url), id], { stdio: "inherit" });
  process.exit(0);
}
const R = REGIONS[REGION_ID];
if (!R) throw new Error(`Unknown region "${REGION_ID}" (have: ${Object.keys(REGIONS).join(", ")})`);
const EUROPE = R.members; // (historic name) the countries coloured on this map
const COLOURED = [...R.members, ...(R.extraColoured || [])];
const CONTEXT = R.context;
Object.assign(capitals, R.extraPoints || {});

const topology = JSON.parse(read("data/countries-10m.json"));
const rawByOwner = new Map(); // alpha3 -> [polygons], polygon = [ring, ring...]
const geomsByOwner = new Map();
const clipHalf = (ring, axis, value, keepGreater) => { // Sutherland-Hodgman against one meridian or parallel, in degrees
  const inside = (p) => (keepGreater ? p[axis] >= value : p[axis] <= value);
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push(axis === 0 ? [value, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), value]);
    }
  }
  return out;
};
for (const g of topology.objects.countries.geometries) {
  const owners = R.nameOwner ? { ...NAME_OWNER, ...R.nameOwner } : NAME_OWNER; // R.nameOwner: shapes this region draws as part of a country
  let a3 = g.id ? numericToA3.get(String(g.id).padStart(3, "0")) : owners[g.properties.name];
  if (g.properties.name in owners) a3 = owners[g.properties.name];
  if (!a3) continue;
  a3 = R.parent?.[a3] || PARENT[a3] || a3; // R.parent: territories this region draws as part of their parent (Puerto Rico in the US)
  if (!geomsByOwner.has(a3)) geomsByOwner.set(a3, []);
  geomsByOwner.get(a3).push(g);
}
// Somalia + Somaliland, Syria + the Golan and Kazakhstan + Baikonur are dissolved into one shape so no seam shows. (Europe's merged pieces, such as Cyprus, keep
// their seam: dissolving them shifted that approved map's labels.)
const DISSOLVE = new Set(["SOM", "SYR", "KAZ"]);
for (const [a3, geoms] of geomsByOwner) {
  const merged = geoms.length > 1 && DISSOLVE.has(a3) ? topojson.merge(topology, geoms) : topojson.feature(topology, { type: "GeometryCollection", geometries: geoms }).features.reduce((m, f) => ({ type: "MultiPolygon", coordinates: [...m.coordinates, ...(f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates)] }), { type: "MultiPolygon", coordinates: [] });
  rawByOwner.set(a3, merged.type === "Polygon" ? [merged.coordinates] : merged.coordinates);
}
// Parts of one country's Natural Earth shape that internationally recognized borders give to another. The part inside
// `region` (an intersection of half-planes [axis (0 lon, 1 lat), degrees, keep the greater side]) moves from `from` to `to`.
//  - Western Sahara: Natural Earth's Morocco includes the Moroccan-administered south; the recognized boundary is the
//    27°40'N parallel (the Tarfaya border).
// (The Golan Heights are cut out of Israel in the site's data itself, by scripts/split-territories.mjs.)
const MOVES = [
  { from: "MAR", to: "ESH", region: [[1, 27 + 40 / 60, false]], what: "Western Sahara" },
];
const key = (c) => `${c[0]},${c[1]}`;
// Join two open rings that share one contiguous run of identical vertices (the arcs their countries share) into one
// outline, so no seam shows. Returns null if they do not share exactly one run.
const stitch = (a, b) => {
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
  const m = b.length, bi = (id) => b.findIndex((c) => key(c) === id);
  const i1 = bi(s1), i0 = bi(s0);
  for (const dir of [1, -1]) { // b's outer part, from the run's far end round to its near end
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
for (const mv of MOVES.filter((m) => R.members.includes(m.to))) {
  const rest = [], moved = [];
  for (const poly of rawByOwner.get(mv.from)) {
    const open = poly[0].slice(0, -1);
    const inRegion = mv.region.reduce((r, [ax, v, g]) => clipHalf(r, ax, v, g), open);
    if (inRegion.length >= 3) moved.push(inRegion);
    // the rest: the part that fails constraint k while meeting constraints 0..k-1 (disjoint pieces)
    mv.region.forEach(([ax, v, g], k) => {
      let r = mv.region.slice(0, k).reduce((q, [ax2, v2, g2]) => clipHalf(q, ax2, v2, g2), open);
      r = clipHalf(r, ax, v, !g);
      if (r.length >= 3 && Math.abs(ringArea(r)) > 1e-4) rest.push([[...r, r[0]], ...(k === 0 ? poly.slice(1) : [])]);
    });
  }
  rawByOwner.set(mv.from, rest);
  const target = rawByOwner.get(mv.to).map((poly) => ({ ring: poly[0].slice(0, -1), holes: poly.slice(1) }));
  const leftovers = [];
  for (const b of moved) {
    let done = false;
    for (const e of target) { const st = stitch(e.ring, b); if (st) { e.ring = st; done = true; break; } }
    if (!done) leftovers.push([[...b, b[0]]]);
  }
  console.log(`${mv.what}: ${moved.length} piece(s) of ${mv.from} moved to ${mv.to}; ${leftovers.length} not stitched`);
  rawByOwner.set(mv.to, [...target.map((e) => [[...e.ring, e.ring[0]], ...e.holes]), ...leftovers]);
}
// R.carve: pieces of a country's shape that this region does not give to it (Matthew Island, which France and Vanuatu both claim).
// A polygon whose bounding-box centre lies in `box` [west, east, south, north] is dropped.
for (const cv of R.carve || []) {
  const [x0, x1, y0, y1] = cv.box, before = rawByOwner.get(cv.from).length;
  rawByOwner.set(cv.from, rawByOwner.get(cv.from).filter((poly) => {
    const xs = poly[0].map((q) => q[0]), ys = poly[0].map((q) => q[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    return !(cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1);
  }));
  console.log(`carved ${before - rawByOwner.get(cv.from).length} piece(s) out of ${cv.from} (${cv.what})`);
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
  if (FRAME.points) { // framed by the places that matter, plus a margin (a continent that a lon/lat window would frame too loosely)
    for (const [lon, lat] of FRAME.points) pts.push(laea(lon, lat));
  } else for (let i = 0; i <= 200; i++) {
    const lon = FRAME.west + ((FRAME.east - FRAME.west) * i) / 200;
    pts.push(laea(lon, FRAME.south), laea(lon, FRAME.north));
    const lat = FRAME.south + ((FRAME.north - FRAME.south) * i) / 200;
    pts.push(laea(FRAME.west, lat), laea(FRAME.east, lat));
  }
  // Fit the western/eastern/southern edges tightly; the fan-shaped north gets a little air.
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  if (FRAME.points) { const m = (FRAME.margin ?? 0.03) * Math.max(maxX - minX, maxY - minY); minX -= m; maxX += m; minY -= m; maxY += m; }
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

// Rings smaller than this (square SVG units) are dropped as specks. R.minRing lowers it for a region of atolls (Oceania).
const MIN_RING = R.minRing ?? 0.05;
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
      if (r.length < 3 || Math.abs(ringArea(r)) < MIN_RING) return;
      rings.push(r);
    });
    if (rings.length && ringArea(poly[0].length ? rings[0] : rings[0]) !== 0) result.push({ rings });
  }
  return result;
}
// Only keep a hole if its outer ring survived: rings after index 0 of a dropped outer are meaningless.
// Land more than 95 degrees from the map's centre can never be in view, and near the opposite side of the globe the
// projection folds over on itself, so such polygons are left out.
const farFromCentre = (ring) => {
  const sinP0 = Math.sin(LAT0), cosP0 = Math.cos(LAT0);
  const step = Math.max(1, Math.floor(ring.length / 40));
  for (let i = 0; i < ring.length; i += step) {
    const l = ring[i][0] * D2R, p = ring[i][1] * D2R;
    if (sinP0 * Math.sin(p) + cosP0 * Math.cos(p) * Math.cos(l - LON0) > -0.087) return false; // within 95 degrees
  }
  return true;
};
function projectClean(polys) {
  const out = [];
  for (const poly of polys) {
    if (farFromCentre(poly[0])) continue;
    const outer = (() => {
      const o = poly[0];
      let r = o.slice(0, o[0][0] === o.at(-1)[0] && o[0][1] === o.at(-1)[1] ? -1 : undefined);
      r = densify(r);
      if (r.length < 3) return null;
      r = clipRing(r.map(([lo, la]) => project(lo, la)), viewWindow.inside, viewWindow.cross);
      return r.length >= 3 && Math.abs(ringArea(r)) >= MIN_RING ? r : null;
    })();
    if (!outer) continue;
    const rings = [outer];
    for (const h of poly.slice(1)) {
      let r = h.slice(0, h[0][0] === h.at(-1)[0] && h[0][1] === h.at(-1)[1] ? -1 : undefined);
      r = densify(r);
      if (r.length < 3) continue;
      r = clipRing(r.map(([lo, la]) => project(lo, la)), viewWindow.inside, viewWindow.cross);
      if (r.length >= 3 && Math.abs(ringArea(r)) >= MIN_RING) rings.push(r);
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

// ---------- lakes (Natural Earth, map-data/lakes.json; see scripts/extract-lakes.mjs) ----------
// Drawn in the sea color on top of the land, so Lake Victoria, the Aral Sea and the rest show as water.
// Display names where Natural Earth's differs; "" = water that is drawn but not labeled.
const LAKE_NAMES = {
  "South Aral Sea": "Aral Sea", "North Aral Sea": "", "Lago Titicaca": "Lake Titicaca", "Lago de Nicaragua": "Lake Nicaragua",
  "Lac Moeru": "Lake Mweru", "Buhayrat ath Tharthar": "Lake Tharthar", "Kaliningradskiy Zaliv": "Vistula Lagoon", "Zalew Wislany": "",
  "Hongze Hu": "Hongze Lake", "Qinghai Hu": "Qinghai Lake", "Khövsgöl Nuur": "Lake Khövsgöl", "Uvs Nuur": "Uvs Lake",
  "Réservoir Manicouagan": "Manicouagan Reservoir", "Lake Razazah": "", "Lake Eyre North": "Lake Eyre", "Lake Eyre South": "", "Lake Pskov": "", Syvash: "", "Georgian Bay": "", "North Channel": "",
  "Saginaw Bay": "", "McLeod Bay": "", "St. Marys River": "", "Whitefish Bay": "", "Laguna Madre": "", "Lake Srednye Kuyto": "", "Ozero Yarroto Vtoroye": "",
};
const LAKE_MIN_AREA = 14; // square SVG units; smaller ones are specks
const lakes = [];
{
  const lakeData = JSON.parse(read("map-data/lakes.json"));
  const g = R.frame.points ? { w: Math.min(...R.frame.points.map((q) => q[0])) - 8, e: Math.max(...R.frame.points.map((q) => q[0])) + 8, s: Math.min(...R.frame.points.map((q) => q[1])) - 8, n: Math.max(...R.frame.points.map((q) => q[1])) + 8 } : { w: R.frame.west - 4, e: R.frame.east + 4, s: R.frame.south - 4, n: R.frame.north + 4 };
  for (const lk of lakeData) {
    const near = lk.p.filter((poly) => poly[0].some(([x, y]) => x >= g.w && x <= g.e && y >= g.s && y <= g.n));
    if (!near.length) continue;
    const polys = projectClean(near);
    if (!polys.length) continue;
    const area = areaOf(polys);
    if (area >= LAKE_MIN_AREA) lakes.push({ name: LAKE_NAMES[lk.n] ?? lk.n, rank: lk.r, polys, area });
  }
  lakes.sort((a, b) => b.area - a.area);
}

// ---------- disputed areas (map-data/disputed.json, see scripts/extract-disputed.mjs) ----------
// Not given to any country: drawn hatched over the countries, with dashed lines where two administered parts meet.
// A region lists the groups it shows (Kashmir; the Southern Kurils; the Senkaku / Diaoyu Islands; Dokdo / Takeshima).
// Tiny ones ("marker") are too small to draw to scale and are shown as a hatched mark.
const disputedGroups = [];
if (R.disputed) {
  const all = JSON.parse(read("map-data/disputed.json"));
  for (const cfg of R.disputed) {
    const areas = all.filter((a) => a.group === cfg.group);
    const shapes = cfg.marker ? [] : projectClean(areas.flatMap((a) => a.p));
    // Edges two different areas share are the lines of control (and the line of actual control): dashed. Found by matching vertices.
    const edgeKey = (a, b) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;
    const owner = new Map();
    areas.forEach((a, ai) => a.p.forEach((poly) => poly.forEach((ring) => ring.forEach((pt, i) => owner.set(edgeKey(pt, ring[(i + 1) % ring.length]), ai)))));
    const runs = [];
    areas.forEach((a, ai) => a.p.forEach((poly) => poly.forEach((ring) => {
      const n = ring.length, shared = ring.map((pt, i) => { const o = owner.get(edgeKey(ring[(i + 1) % n], pt)); return o !== undefined && o > ai; }); // each shared edge once, from the lower-numbered area
      if (shared.every(Boolean) || !shared.some(Boolean)) return;
      let start = shared.findIndex((v, i) => !v && shared[(i + 1) % n]); // an edge before a shared run
      start = (start + 1) % n;
      let run = null;
      for (let k = 0; k < n; k++) {
        const i = (start + k) % n;
        if (shared[i]) { run = run || [ring[i]]; run.push(ring[(i + 1) % n]); } else if (run) { runs.push(run); run = null; }
      }
      if (run) runs.push(run);
    })));
    const markers = [];
    if (cfg.marker) {
      const pts = cfg.at || areas.flatMap((a) => a.p.flatMap((poly) => poly[0])); // cfg.at: [lon, lat] points, for a mark whose area is not in disputed.json
      const lo = Math.min(...pts.map((q) => q[0])), hi = Math.max(...pts.map((q) => q[0])), la = Math.min(...pts.map((q) => q[1])), lb = Math.max(...pts.map((q) => q[1]));
      const [mx, my] = project((lo + hi) / 2, (la + lb) / 2);
      if (mx > 6 && mx < WIDTH - 6 && my > 6 && my < HEIGHT - 6) {
        if (cfg.ring) { // scattered islands: an oval over the area they lie in (not drawn to scale, and not a claim to the waters)
          const c = [project(lo, la), project(lo, lb), project(hi, la), project(hi, lb)];
          markers.push([mx, my, Math.max(3.6, (Math.max(...c.map((q) => q[0])) - Math.min(...c.map((q) => q[0]))) / 2 + 2), Math.max(3.6, (Math.max(...c.map((q) => q[1])) - Math.min(...c.map((q) => q[1]))) / 2 + 2)]);
        } else markers.push([mx, my]);
      }
    }
    if (!shapes.length && !markers.length) continue; // outside this map's frame
    console.log(`disputed: ${cfg.group}: ${areas.length} area(s)${runs.length ? `, ${runs.length} line(s) of control` : ""}`);
    const xs = shapes.flatMap((p) => p.rings[0].map((q) => q[0])), ys = shapes.flatMap((p) => p.rings[0].map((q) => q[1]));
    disputedGroups.push({ cfg, shapes, markers, runs: runs.map((r) => r.map(([lon, lat]) => project(lon, lat))), bbox: shapes.length ? { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } : null });
  }
}

// ---------- colouring: no two neighbours (by land or a narrow sea) share a colour ----------

// Colored nodes: the members, plus (where a region fixes colors, as North America does) its extra territories.
// A territory in R.share takes a member's colour on this map (the Cook Islands in New Zealand's), so it is not coloured itself:
// its neighbours count as the member's, which keeps them from sharing that colour.
const NODES = (R.fixedColours ? COLOURED : EUROPE).filter((a) => !(a in R.share));
const adjacency = new Map(NODES.map((a) => [a, new Set()]));
const link = (a, b) => { a = R.share[a] || a; b = R.share[b] || b; if (adjacency.has(a) && adjacency.has(b) && a !== b) { adjacency.get(a).add(b); adjacency.get(b).add(a); } };
for (const c of countries) for (const b of c.borders || []) link(c.alpha3Code, b);
for (const [a, b] of R.links) link(a, b);

function colourGraph(nodes, adj, k, fixed = new Map()) {
  // DSATUR, then verify; falls back to more colours only if k is too few. `fixed` colors are set first.
  const colour = new Map(fixed);
  for (const [a, c] of fixed) for (const b of adj.get(a) || []) if (fixed.get(b) === c) throw new Error(`${a} and ${b} are neighbours with the same fixed colour`);
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
// Territories drawn in their parent's colour from another map (Greenland in Denmark's colour from the Europe map). A value is a
// parent code (its colour on the Europe map) or [map, parent code]. Territories of one parent form a family and share one
// colour; if a family's colour is also its neighbour's (Sint Maarten and Saint Martin share an island, the Netherlands and
// France being the same colour on the Europe map), the later family takes the first colour that is free, and says so.
function fixedColours() {
  const fixed = new Map();
  if (!R.fixedColours) return fixed;
  const pageColour = (map, code) => {
    const m = read(`maps/${map}/index.html`).match(new RegExp(`<path class="c c(\\d+)" data-code="${code}"`));
    if (!m) throw new Error(`No colour for ${code} on the ${map} map`);
    return Number(m[1]);
  };
  const families = new Map();
  for (const [a, src] of Object.entries(R.fixedColours)) {
    if (!shapes.has(a)) continue;
    const [map, code] = Array.isArray(src) ? src : ["europe", src];
    const key = `${map}:${code}`;
    if (!families.has(key)) families.set(key, { code, colour: pageColour(map, code), members: [] });
    families.get(key).members.push(a);
  }
  const done = [];
  for (const f of families.values()) {
    const clash = (c) => done.some((g) => g.colour === c && g.members.some((m) => f.members.some((n) => adjacency.get(m)?.has(n))));
    if (clash(f.colour)) {
      const was = f.colour;
      let c = 0;
      while (clash(c)) c++;
      f.colour = c;
      console.log(`note: ${f.code}'s territories (${f.members.join(", ")}) are colour ${c}, not ${was}, to differ from their neighbours`);
    }
    done.push(f);
    for (const m of f.members) fixed.set(m, f.colour);
  }
  return fixed;
}
const colours = process.env.INSET_COLOURS ? new Map(Object.entries(JSON.parse(process.env.INSET_COLOURS))) : colourGraph(NODES.filter((a) => shapes.has(a)), new Map([...adjacency].filter(([a]) => shapes.has(a)).map(([a, s]) => [a, new Set([...s].filter((b) => shapes.has(b)))])), PALETTE_SIZE, fixedColours());
for (const [a, parent] of Object.entries(R.share)) colours.set(a, colours.get(parent)); // e.g. Greenland: part of the Kingdom of Denmark
for (const [a, c] of Object.entries(R.colourOverride || {})) colours.set(a, c); // a colour a region sets by hand (Fiji on the Oceania map: one no parent of a territory uses)

// An inset (an enlarged region drawn by this same script in its own projection) goes in an empty corner, with a thin
// outline on the main map showing its area.
const INSET_HEAD = 24;
let INSET = null, insetBox = null, insetOutline = "";
if (R.inset) {
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), R.inset.region], { env: { ...process.env, INSET_COLOURS: JSON.stringify(Object.fromEntries(colours)) }, encoding: "utf8", maxBuffer: 1 << 28 });
  for (const line of out.split("\n")) {
    if (line.startsWith("@@INSET@@")) INSET = JSON.parse(line.slice(9));
    else if (line.trim()) console.log(`  [inset] ${line}`);
  }
  if (!INSET) throw new Error("The inset did not produce a drawing");
  const m = R.inset.margin;
  insetBox = R.inset.corner === "top-right" ? [WIDTH - m - INSET.w, m, WIDTH - m, m + INSET_HEAD + INSET.h] : [m, HEIGHT - m - INSET_HEAD - INSET.h, m + INSET.w, HEIGHT - m];
  insetOutline = "M" + INSET.outline.map(([lon, lat]) => project(lon, lat).map(f1x).join(" ")).join("L") + "Z";
  { // check: every place the inset shows is inside the outline on this map, and nothing outside it is
    const lp = (lon, lat) => { const l = lon * D2R, p = lat * D2R, l0 = INSET.proj.lon0 * D2R, p0 = INSET.proj.lat0 * D2R;
      const k = Math.sqrt(2 / (1 + Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0)));
      return [(k * Math.cos(p) * Math.sin(l - l0) + INSET.proj.x0) * INSET.proj.scale, (INSET.proj.y0 - k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0))) * INSET.proj.scale]; };
    const poly = INSET.outline.map(([lon, lat]) => project(lon, lat));
    const inPoly = ([x, y]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; return c; };
    let bad = 0, total = 0;
    const lons = INSET.outline.map((q) => q[0]), lats = INSET.outline.map((q) => q[1]);
    for (let lon = Math.min(...lons) - 1; lon <= Math.max(...lons) + 1; lon += 0.1) for (let lat = Math.min(...lats) - 1; lat <= Math.max(...lats) + 1; lat += 0.1) {
      const [ix, iy] = lp(lon, lat), inInset = ix >= 1 && ix <= INSET.w - 1 && iy >= 1 && iy <= INSET.h - 1, outInset = ix < -1 || ix > INSET.w + 1 || iy < -1 || iy > INSET.h + 1;
      if (!inInset && !outInset) continue; // on the edge itself
      total++;
      if (inInset !== inPoly(project(lon, lat))) bad++;
    }
    console.log(`inset outline check: ${bad} of ${total} places disagree`);
  }
}

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
// Areas no country label may cover (a disputed area), when a region has one; null otherwise.
let BLOCK = null;
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
    else if (BLOCK && BLOCK.some((b) => ox >= b.x0 && ox <= b.x1 && oy >= b.y0 && oy <= b.y1 && insidePoly(b.shapes, ox, oy))) grid[j * cols + i] = 0;
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
const CAP_SKIP_NAME = new Set(Object.keys(CALLOUTS).filter((a) => !(R.capitalNames || []).includes(a))); // their callout carries the name

const capitalPoint = (a3) => {
  const key = a3 === "UNK" ? "KOS" : a3;
  const c = capitals[key];
  return c ? { name: c.name, xy: project(c.lon, c.lat), gap: c.gap } : null;
};

const labelOut = []; // {a3, name, lines, size, x, y, angle, kind}
const capOut = [];   // {name, x, y, nx, ny, anchor}
const calloutOut = [];
const autoCallouts = [];

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
if (insetBox) { // keep the main map's labels out of the inset, and check nothing coloured sits under it
  obstacles.push(insetBox);
  for (const d of capDots) if (d.x > insetBox[0] - 6 && d.x < insetBox[2] + 6 && d.y > insetBox[1] - 6 && d.y < insetBox[3] + 6) console.log(`WARNING: the inset covers the capital dot of ${d.a3}`);
}

// A disputed area's name goes in it first (where it fits), and no country label may cover the area.
for (const g of disputedGroups.filter((d) => d.shapes.length)) {
  if (g.cfg.label) {
    const fit = fitLabel(g.shapes, g.cfg.label, { maxSize: 14, minSize: 7, blocked: obstacles, angles: [0, -0.35, 0.35, -0.7, 0.7, -1.05, 1.05, Math.PI / 2] });
    if (fit) {
      labelOut.push({ a3: "DISP", name: g.cfg.label, lines: fit.lines, size: fit.size, x: fit.pos[0], y: fit.pos[1], angle: fit.angle, kind: "dispute" });
      const c = Math.abs(Math.cos(fit.angle)), sn = Math.abs(Math.sin(fit.angle));
      const ob = [fit.pos[0] - ((fit.w * c + fit.h * sn) / 2 + 1), fit.pos[1] - ((fit.w * sn + fit.h * c) / 2 + 1), fit.pos[0] + ((fit.w * c + fit.h * sn) / 2 + 1), fit.pos[1] + ((fit.w * sn + fit.h * c) / 2 + 1)];
      if (fit.angle) ob.rot = { cx: fit.pos[0], cy: fit.pos[1], w: fit.w + 2, h: fit.h + 2, angle: fit.angle };
      obstacles.push(ob);
    } else console.log(`WARNING: no room for the ${g.cfg.group} label`);
  }
}
if (disputedGroups.some((d) => d.shapes.length)) BLOCK = disputedGroups.filter((d) => d.shapes.length).map((d) => ({ ...d.bbox, shapes: d.shapes }));

// Crowded capitals (the Levant) are named first, so the big country labels fit around them rather than over them.
const namedEarly = new Set();
for (const a3 of R.capFirst || []) {
  const d = capDots.find((c) => c.a3 === a3);
  if (d && !CAP_SKIP_NAME.has(a3)) { nameCapital(d); namedEarly.add(a3); }
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
// The Golan Heights (part of Syria) get their own small label and a dashed outline, on maps that ask for it.
let golanShape = null;
if (R.golan) {
  const g = topology.objects.countries.geometries.find((x) => x.properties?.name === "Golan Heights");
  const geo = topojson.feature(topology, g).geometry;
  golanShape = projectClean(geo.type === "Polygon" ? [geo.coordinates] : geo.coordinates);
  // The Golan is a narrow strip: its name goes on the Syrian land just east of it, with a short leader.
  const [gx, gy] = centroidOf(golanShape);
  const lines = ["GOLAN", "HEIGHTS"], size = 8;
  const w = Math.max(...lines.map((l) => textWidth(l, size, SPACING))) + 3, h = size * LINE_H + size * CAP_H + 3;
  const syria = shapes.get("SYR");
  let best = null;
  for (let dy = -60; dy <= 60; dy += 3) for (let dx = 14; dx <= 110; dx += 3) {
    const box = [gx + dx - w / 2, gy + dy - h / 2, gx + dx + w / 2, gy + dy + h / 2];
    if (obstacles.some((o) => boxOverlap(o, box))) continue;
    let ok = true;
    for (let i = 0; i <= 4 && ok; i++) for (let j = 0; j <= 2; j++) {
      const px = box[0] + (w * i) / 4, py = box[1] + (h * j) / 2;
      if (!insidePoly(syria, px, py) || insidePoly(golanShape, px, py)) { ok = false; break; }
    }
    if (!ok) continue;
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { d, box, x: gx + dx, y: gy + dy };
  }
  if (best) {
    labelOut.push({ a3: "GLN", name: "Golan Heights", lines, size, x: best.x, y: best.y, angle: 0, kind: "golan", leader: [Math.min(Math.max(gx, best.box[0]), best.box[2]), Math.min(Math.max(gy, best.box[1]), best.box[3]), gx, gy] });
    obstacles.push(best.box);
  } else console.log("WARNING: no room for a Golan Heights label");
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
  if (R.balancedMicroLabels === "only" && words.length > 2) variants.splice(1, 1); // (replacing the first-word split below)
  if (R.balancedMicroLabels && words.length > 2) { // two lines of about equal width ("SAINT PIERRE AND" / "MIQUELON (FRANCE)")
    let split = 1, gapMin = Infinity;
    for (let k = 1; k < words.length; k++) {
      const gap = Math.abs(textWidth(words.slice(0, k).join(" "), CALL_SIZE) - textWidth(words.slice(k).join(" "), CALL_SIZE));
      if (gap < gapMin) { gapMin = gap; split = k; }
    }
    variants.push([words.slice(0, split).join(" "), words.slice(split).join(" ")]);
  }
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
  const pad = R.microPad || 0;
  for (const strict of pad ? [true, false] : [false]) { // first without any pointer line through another label; if that leaves no place, allow it
  if (best) break;
  for (const lines of variants) {
    const w = Math.max(...lines.map((l) => textWidth(l, CALL_SIZE, 0.04))) + 4, h = lines.length * CALL_LINE + 1;
    for (let cy = y - 190; cy <= y + 190; cy += 4) for (let cx = x - 190; cx <= x + 190; cx += 4) {
      if (MICRO_SIDE[a3] === "east" && cx < x + 8) continue;
      if (MICRO_SIDE[a3] === "west" && cx > x - 8) continue;
      if (MICRO_SIDE[a3] === "south" && cy < y + 8) continue;
      if (MICRO_SIDE[a3] === "north" && cy > y - 8) continue;
      const box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
      if (box[0] < 8 || box[2] > WIDTH - 8 || box[1] < 8 || box[3] > HEIGHT - 8) continue;
      const padded = pad ? [box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad] : box; // R.microPad: keep pointer labels apart
      if (obstacles.some((o) => boxOverlap(o, padded))) continue;
      let wet = true;
      const nI = pad ? 40 : 14, nJ = pad ? 8 : 4; // a denser check keeps labels off tiny islands
      for (let i = 0; i <= nI && wet; i++) for (let j = 0; j <= nJ; j++) if (countryAtMask(box[0] - 0.5 + ((box[2] - box[0] + 1) * i) / nI, box[1] - 0.5 + ((box[3] - box[1] + 1) * j) / nJ)) { wet = false; break; }
      if (!wet) continue;
      const nx = Math.min(Math.max(x, box[0]), box[2]), ny = Math.min(Math.max(y, box[1]), box[3]);
      const d = Math.hypot(nx - x, ny - y);
      if (cap.gap && d < cap.gap) continue; // a mark that must stay visible keeps its label at a distance
      if (strict) { // the pointer line must not run through another label
        const len = Math.hypot(nx - x, ny - y);
        let crosses = false;
        for (let t = 5; t < len - 1 && !crosses; t += 3) {
          const px = x + ((nx - x) * t) / len, py = y + ((ny - y) * t) / len;
          crosses = obstacles.some((o) => o[2] - o[0] > 12 && o[3] - o[1] > 5 && px >= o[0] && px <= o[2] && py >= o[1] && py <= o[3]);
        }
        if (crosses) continue;
      }
      if (d > (best ? best.score : 400)) continue;
      const crossed = new Set();
      for (let t = 1; t < 30; t++) { const c = countryAtMask(x + ((nx - x) * t) / 30, y + ((ny - y) * t) / 30); if (c && c !== a3) crossed.add(c); }
      const score = d + 22 * crossed.size + (lines.length === 2 ? 4 : 0);
      if (!best || score < best.score) best = { score, d, crossed: crossed.size, lines, w, h, box, nx, ny };
    }
  }
  } // strictness
  if (!best) { console.log(`WARNING: no open water found for ${a3}`); return; }
  obstacles.push(best.box);
  if (R.microPad) { // the pointer line itself is kept clear by later labels
    const len = Math.hypot(best.nx - x, best.ny - y);
    for (let t = 0; t <= len; t += 4) obstacles.push([x + ((best.nx - x) * t) / len - 1.5, y + ((best.ny - y) * t) / len - 1.5, x + ((best.nx - x) * t) / len + 1.5, y + ((best.ny - y) * t) / len + 1.5]);
  }
  calloutOut.push({ a3, name: nameOf(a3), x, y, lines: best.lines, box: best.box, nx: best.nx, ny: best.ny });
  console.log(`callout ${nameOf(a3)}: line ${Math.round(best.d)} long, crosses ${best.crossed} other countr${best.crossed === 1 ? "y" : "ies"}`);
}
if (R.microPad) for (const a3 of MICRO) { const pt = capitalPoint(a3); if (pt) obstacles.push([pt.xy[0] - 4, pt.xy[1] - 4, pt.xy[0] + 4, pt.xy[1] + 4]); } // the islands' own marks stay clear
for (const a3 of MICRO) placeMicro(a3);
// 3a) countries too small for a full-size label: a small label centred on the country that may spill
// over its borders (as on the reference map); a pointer-line callout only if even that does not fit.
const allShapes = [...shapes.values()];
const onLand = (x, y) => allShapes.some((polys) => insidePoly(polys, x, y));
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
for (const a3 of byArea(unlabelled.filter((a) => EUROPE.includes(a) && !(R.unlabelled || []).includes(a)))) {
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
for (const a3 of unlabelled.filter((a) => EUROPE.includes(a) && !spilled.has(a) && !(R.unlabelled || []).includes(a))) {
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
function nameCapital({ a3, cap, x, y }) {
  if (CAP_SKIP_NAME.has(a3) || autoCallouts.some((c) => c.a3 === a3) || (R.unlabelled || []).includes(a3)) { capOut.push({ name: null, x, y }); return; }
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
  const free = [...new Set([R.capSide?.[a3], "r", "l", "b", "t", "tr", "tl", "br", "bl"].filter(Boolean))].map((k) => sides[k]).filter(ok);
  const wanted = R.capSide?.[a3] && free.find((f) => f === sides[R.capSide[a3]]); // a side pinned in the region's config wins
  const chosen = wanted || free.find(inOwn) || free[0];
  if (chosen) { obstacles.push(chosen.box); capOut.push({ name: cap.name, x, y, nx: chosen.nx, ny: chosen.ny, anchor: chosen.anchor }); }
  else capOut.push({ name: null, x, y });
}
for (const d of capDots) if (!namedEarly.has(d.a3)) nameCapital(d);
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

// ---------- lake names (placed last, around everything else, so no other label moves) ----------
// The biggest lakes are named in the sea style, inside the lake where the name fits (tilted along a long one); a very
// big lake whose name does not fit inside gets it beside it.
const lakeOut = [];
{
  for (const t of seaOut) { // keep out of the sea names
    const w = textWidth(t.t, t.size, t.sp), a = (t.rot * Math.PI) / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
    const hw = (w * c + t.size * sn) / 2 + 1, hh = (w * sn + t.size * c) / 2 + 1;
    obstacles.push([t.x - hw, t.y - hh, t.x + hw, t.y + hh]);
  }
  // A tilted country label blocks only its real rectangle (small tiles along it), not its whole bounding box.
  const trueBoxes = obstacles.flatMap((o) => {
    if (!o.rot) return [o];
    const { cx, cy, w, h, angle } = o.rot, n = Math.ceil(w / 4), tiles = [];
    for (let i = 0; i < n; i++) {
      const u = -w / 2 + ((i + 0.5) * w) / n, x = cx + u * Math.cos(angle), y = cy + u * Math.sin(angle), r = Math.abs(h * Math.cos(angle)) / 2 + 2.5 + Math.abs(Math.sin(angle)) * 0, hh = Math.abs(h * Math.cos(angle)) / 2 + Math.abs(4 * Math.sin(angle)) + 1;
      tiles.push([x - Math.abs(4 * Math.cos(angle)) - Math.abs(h / 2 * Math.sin(angle)) - 0.5, y - hh - 0.5, x + Math.abs(4 * Math.cos(angle)) + Math.abs(h / 2 * Math.sin(angle)) + 0.5, y + hh + 0.5]);
    }
    return tiles;
  });
  const LAKE_SP = 0.08, ANGLES = [0, -0.35, 0.35, -0.7, 0.7, -1.05, 1.05, Math.PI / 2];
  for (const lake of lakes) {
    if (!lake.name || !(lake.rank <= 3 || (lake.rank <= 5 && lake.area >= 250))) continue;
    const polys = bigPolys(lake.polys);
    const rasters = new Map(ANGLES.map((a) => [a, rasterise(polys, a, trueBoxes)]));
    let best = null;
    const words = lake.name.split(" ");
    const variants = [[lake.name]];
    if (words.length > 1) variants.push([words[0], words.slice(1).join(" ")]); // "Lake" / "Victoria"
    for (const lines of variants) for (const angle of ANGLES) for (let size = 11; size >= 6.5; size -= 0.5) {
      const w = Math.max(...lines.map((l) => textWidth(l, size, LAKE_SP))) + size * 0.4, h = size * 0.92 + (lines.length - 1) * size * LINE_H;
      const pos = placeRect(rasters.get(angle), w, h);
      if (!pos) continue;
      const score = size * (angle === 0 ? 1.2 : 1) * (lines.length === 1 ? 1.1 : 1);
      if (!best || score > best.score) best = { size, pos, angle, score, w, h, out: false, lines };
      break;
    }
    if (!best && lake.rank <= 1) { // beside the lake
      const xs = lake.polys.flatMap((p) => p.rings[0].map((q) => q[0])), ys = lake.polys.flatMap((p) => p.rings[0].map((q) => q[1]));
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      outer: for (const size of [9, 8, 7]) {
        const w = textWidth(lake.name, size, LAKE_SP) + 4, h = size * 1.05;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const x = cx + dx * ((x1 - x0) / 2 + w / 2 + 3), y = cy + dy * ((y1 - y0) / 2 + h / 2 + 3);
          const box = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
          if (box[0] < 6 || box[2] > WIDTH - 6 || box[1] < 6 || box[3] > HEIGHT - 6 || obstacles.some((o) => boxOverlap(o, box))) continue;
          best = { size, pos: [x, y], angle: 0, w, h, out: true, lines: [lake.name] };
          break outer;
        }
      }
    }
    if (!best) continue;
    const c = Math.abs(Math.cos(best.angle)), sn = Math.abs(Math.sin(best.angle));
    const hw = (best.w * c + best.h * sn) / 2 + 1, hh = (best.w * sn + best.h * c) / 2 + 1;
    obstacles.push([best.pos[0] - hw, best.pos[1] - hh, best.pos[0] + hw, best.pos[1] + hh]);
    lakeOut.push({ name: lake.name, lines: best.lines, x: best.pos[0], y: best.pos[1], size: best.size, rot: (best.angle * 180) / Math.PI, out: best.out });
  }
  if (lakeOut.length) console.log(`lake names: ${lakeOut.map((l) => l.name + (l.out ? " (beside)" : "")).join(", ")}`);
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
// R.dotOnly: territories drawn as a dot even without a visible shape (Tokelau has none in the data).
const territoryDots = (R.dots || []).filter((a) => (shapes.has(a) || (R.dotOnly || []).includes(a)) && capitalPoint(a)).map((a) => { const [x, y] = capitalPoint(a).xy; return `<circle class="c c${colours.get(a)}" cx="${f1(x)}" cy="${f1(y)}" r="2.6" />`; }).join("\n      ");
const capMarkup = (territoryDots ? territoryDots + "\n      " : "") + capOut
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

const disputedMarkup = disputedGroups.map((g) => {
  const d = pathOf(g.shapes);
  return `<g class="disputed">${g.shapes.length ? `
        <path class="disp" d="${d}" />
        <path class="disp-hatch" d="${d}" />
        <path class="disp-line" d="${g.runs.map((r) => "M" + r.map(([x, y]) => `${f1(x)} ${f1(y)}`).join("L")).join("")}" />` : ""}${g.markers.map(([x, y, rx, ry]) => (rx
    ? `
        <ellipse class="disp-dot" cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}" />
        <ellipse class="disp-dot-hatch" cx="${f1(x)}" cy="${f1(y)}" rx="${f1(rx)}" ry="${f1(ry)}" />`
    : `
        <circle class="disp-dot" cx="${f1(x)}" cy="${f1(y)}" r="3.6" />
        <circle class="disp-dot-hatch" cx="${f1(x)}" cy="${f1(y)}" r="3.6" />`)).join("")}
      </g>
      `;
}).join("");
const lakeMarkup = lakes.length ? `<g class="lakes">
      ${lakes.map((l) => `<path class="lake" d="${pathOf(l.polys)}" />`).join("\n      ")}
      </g>
      ` : "";
const lakeLabelMarkup = lakeOut.length ? `<g class="lake-names">
      ${lakeOut.map((l) => `<text class="sea${l.out ? " out" : ""}" transform="translate(${f1(l.x)} ${f1(l.y)}) rotate(${f1(l.rot)})" text-anchor="middle" dy="${f1(l.size * 0.35)}" font-size="${l.size}" letter-spacing="0.08em">${l.lines.length === 1 ? esc(l.lines[0]) : l.lines.map((t, i) => `<tspan x="0" dy="${f1(i === 0 ? -((l.lines.length - 1) * l.size * LINE_H) / 2 : l.size * LINE_H)}">${esc(t)}</tspan>`).join("")}</text>`).join("\n      ")}
      </g>
      ` : "";
const golanOutline = golanShape ? `<path class="golan-line" d="${pathOf(golanShape)}" />` : "";
const body = `<rect class="ocean" width="${WIDTH}" height="${HEIGHT}" />
      <g class="seas">
      ${seaMarkup}
      </g>
      <g class="land" filter="url(#shadow)">
      ${landMarkup.grey}
      ${landMarkup.euro}
      </g>
      ${disputedMarkup}${lakeMarkup}${lakeLabelMarkup}${golanOutline ? golanOutline + "\n      " : ""}<g class="labels">
      ${countryLabels}
      </g>
      <g class="callouts">
      ${spillLeaders}
      ${calloutMarkup}
      </g>
      <g class="capitals">
      ${capMarkup}
      </g>`;

if (R.fragment) {
  // The inset: hand the drawing and the geographic outline of its rectangle back to the main map's run.
  const x0 = -X0, y0 = Y0;
  const inverse = (X, Y) => { // inverse Lambert azimuthal equal-area, SVG units -> degrees
    const x = X / SCALE + x0, y = y0 - Y / SCALE, rho = Math.hypot(x, y), c = 2 * Math.asin(Math.min(1, rho / 2));
    const lat = Math.asin(Math.cos(c) * Math.sin(LAT0) + (y * Math.sin(c) * Math.cos(LAT0)) / rho);
    const lon = LON0 + Math.atan2(x * Math.sin(c), rho * Math.cos(LAT0) * Math.cos(c) - y * Math.sin(LAT0) * Math.sin(c));
    return [lon / D2R, lat / D2R];
  };
  const outline = [];
  const N = 16;
  for (let i = 0; i < N; i++) outline.push(inverse((WIDTH * i) / N, 0));
  for (let i = 0; i < N; i++) outline.push(inverse(WIDTH, (HEIGHT * i) / N));
  for (let i = 0; i < N; i++) outline.push(inverse(WIDTH - (WIDTH * i) / N, HEIGHT));
  for (let i = 0; i < N; i++) outline.push(inverse(0, HEIGHT - (HEIGHT * i) / N));
  console.log("@@INSET@@" + JSON.stringify({ w: WIDTH, h: HEIGHT, body, outline, proj: { lon0: R.lon0, lat0: R.lat0, scale: SCALE, x0: X0, y0: Y0 } }));
  process.exit(0);
}

const insetMarkup = INSET
  ? `<path class="inset-outline" d="${insetOutline}" />
      <g class="inset" transform="translate(${f1(insetBox[0])} ${f1(insetBox[1])})">
        <rect class="inset-head" width="${INSET.w}" height="${INSET_HEAD + 8}" rx="6" />
        <text class="inset-title" x="10" y="${INSET_HEAD * 0.7}">${esc(R.inset.title)}</text>
        <svg x="0" y="${INSET_HEAD}" width="${INSET.w}" height="${INSET.h}" viewBox="0 0 ${INSET.w} ${INSET.h}">
      ${INSET.body}
        </svg>
        <rect class="inset-border" width="${INSET.w}" height="${INSET_HEAD + INSET.h}" rx="6" />
      </g>`
  : "";

const svg = `<svg class="map-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="map-title map-desc" xmlns="http://www.w3.org/2000/svg">
    <title id="map-title">Political map of ${R.name}</title>
    <desc id="map-desc">${R.name}'s countries, each in a color that differs from its neighbors, with country names, capital cities and the surrounding seas labeled.${INSET ? " An inset enlarges the Levant." : ""}</desc>
    <defs>${disputedGroups.length ? `
      <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="hatch-line" x1="0" y1="0" x2="0" y2="5" /></pattern>` : ""}
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="1.5" dy="3" stdDeviation="3" class="shadow-flood" /></filter>
      <clipPath id="frame"><rect width="${WIDTH}" height="${HEIGHT}" rx="14" /></clipPath>
    </defs>
    <g clip-path="url(#frame)">
      ${body}${insetMarkup ? "\n      " + insetMarkup : ""}
    </g>
  </svg>`;

// ---------- page ----------

const THEME_SNIPPET = `try{var s=localStorage.getItem(${JSON.stringify(DARK_MODE_KEY)});var d=s===null?matchMedia("(prefers-color-scheme: dark)").matches:s==="true";document.documentElement.classList.toggle("dark",d)}catch(e){}`;
const TOGGLE_SNIPPET = `(function(){var b=document.getElementById("dark-mode-toggle"),i=document.getElementById("dark-mode-icon"),r=document.documentElement;function sync(){var d=r.classList.contains("dark");b.setAttribute("aria-pressed",String(d));i.textContent=d?"\\u2600\\uFE0F":"\\uD83C\\uDF19"}sync();b.addEventListener("click",function(){var d=!r.classList.contains("dark");r.classList.toggle("dark",d);try{localStorage.setItem(${JSON.stringify(DARK_MODE_KEY)},String(d))}catch(e){}sync()})})();`;

// Phone viewer: a tap on the map opens it full screen; one finger drags, two fingers pinch, the buttons zoom.
const VIEWER_SNIPPET = `(function(){
var open=document.getElementById("map-open"),viewer=document.getElementById("map-viewer"),stage=document.getElementById("map-stage");
if(!open||!viewer||!stage)return;
var narrow=window.matchMedia("(max-width: 700px)"),svg=null,s=1,tx=0,ty=0,base=1,w0=0,h0=0,MAX=10,minS=1,pts={},last=null,pushed=false,pinch=null;
function size(){var r=stage.getBoundingClientRect();return[r.width,r.height]}
function clamp(){var sz=size(),W=w0*s,H=h0*s;
 tx=W<=sz[0]?(sz[0]-W)/2:Math.min(0,Math.max(sz[0]-W,tx));ty=H<=sz[1]?(sz[1]-H)/2:Math.min(0,Math.max(sz[1]-H,ty))}
function apply(){clamp();svg.style.transform="translate("+tx+"px,"+ty+"px) scale("+s+")"}
function zoomAt(f,cx,cy){var n=Math.min(MAX,Math.max(minS,s*f));f=n/s;tx=cx-(cx-tx)*f;ty=cy-(cy-ty)*f;s=n;apply()}
function fit(){var sz=size(),ratio=svg.viewBox.baseVal.height/svg.viewBox.baseVal.width;w0=sz[0];h0=w0*ratio;
 svg.style.width=w0+"px";svg.style.height=h0+"px";
 if(narrow.matches){minS=1;s=Math.min(3,Math.max(1,sz[1]/h0))}else{minS=Math.min(1,sz[1]/h0);s=minS}tx=(sz[0]-w0*s)/2;ty=(sz[1]-h0*s)/2;apply()}
function show(){svg=open.querySelector("svg").cloneNode(true);svg.removeAttribute("class");svg.setAttribute("class","map-svg map-svg-big");
 svg.style.minWidth="0";stage.innerHTML="";stage.appendChild(svg);viewer.hidden=false;document.documentElement.classList.add("map-viewer-open");
 fit();document.getElementById("map-close").focus();try{history.pushState({mapViewer:1},"");pushed=true}catch(e){}}
function hide(fromPop){if(viewer.hidden)return;viewer.hidden=true;document.documentElement.classList.remove("map-viewer-open");stage.innerHTML="";svg=null;
 if(pushed&&!fromPop){pushed=false;try{history.back()}catch(e){}}pushed=false;open.focus()}
open.addEventListener("click",show);
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
stage.addEventListener("dblclick",function(e){var p=rel(e);zoomAt(s>=MAX/2?minS/s:2,p[0],p[1])});
})();`;

const FAVICON = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌍</text></svg>`;

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Map of ${R.name}: Countries, Capitals &amp; Seas | Country Facts</title>
  <meta name="description" content="A colorful political map of ${R.name} with every country, capital city and sea labeled." />
  <link rel="canonical" href="${BASE_URL}/maps/${REGION_ID}/" />
${INDEXABLE ? "" : `  <meta name="robots" content="noindex" />\n`}  <meta property="og:url" content="${BASE_URL}/maps/${REGION_ID}/" />
  ${socialTags({ baseUrl: BASE_URL, siteName: "Country Facts", title: `Map of ${R.name}: Countries, Capitals & Seas | Country Facts`, description: `A colorful political map of ${R.name} with every country, capital city and sea labeled.`, image: `og/map-${REGION_ID}.png` })}
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
    <nav class="crumbs" aria-label="Breadcrumb"><a href="../../">Country Facts</a> <span aria-hidden="true">›</span> <a href="../">Maps</a> <span aria-hidden="true">›</span> <span>${R.slug || R.name}</span></nav>
    <section class="page-card map-card">
      <a class="map-back" href="../">← All maps</a>
      <h1>Political map of ${R.name}</h1>
      <p class="map-lede">${EUROPE.filter((a) => shapes.has(a)).length} ${R.unit || "countries"}, each colored differently from its neighbors. ${R.lede}</p>
      <p class="map-hint"><span class="hint-touch">Tap the map to open it full size, then pinch to zoom.</span><span class="hint-mouse">Click the map to open it full screen, then scroll to zoom and drag to move.</span></p>
      <button type="button" class="map-open" id="map-open" style="--ratio:${(WIDTH / HEIGHT).toFixed(4)}" aria-label="Open the map full size">
  ${svg}
      </button>
      <p class="map-note">Borders: <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a> (public domain). Capital cities: Natural Earth populated places. ${R.noteExtra}</p>
    </section>
  <div class="map-viewer" id="map-viewer" role="dialog" aria-modal="true" aria-label="Map of ${R.name}, full size" hidden>
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
