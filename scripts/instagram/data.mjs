// Data side of the Instagram post generator: the 195 countries, their facts, quiz questions and captions.
// Everything comes from this repo (data/countries.json, the shape data, the built map and country pages); nothing is fetched.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ALL_MAPS, MAP_REGIONS } from "../map-regions.mjs";

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const T = require(path.join(ROOT, "country-text.js"));
export const all = JSON.parse(fs.readFileSync(path.join(ROOT, "data/countries.json"), "utf8"));
export const sovereign = all.filter((c) => c.sovereign);
export const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
export { ALL_MAPS, MAP_REGIONS };

export const nameOf = (c) => T.getBorderDisplayName(c.name);
export const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const countrySlug = (c) => slugify(nameOf(c));
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const shuffle = (list) => list.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

export function findCountry(code) {
  const k = String(code || "").toUpperCase();
  const c = sovereign.find((x) => x.alpha3Code === k || x.alpha2Code === k || nameOf(x).toUpperCase() === k || x.name.toUpperCase() === k);
  if (!c) throw new Error(`No country "${code}" among the 195 (use an alpha-2 or alpha-3 code, e.g. BR or BRA)`);
  return c;
}

// ---- region names ----
// The data uses UN statistical names; captions and slides use the familiar ones. Names not listed here are used as they are.
const FRIENDLY_REGIONS = {
  "Middle Africa": "Central Africa",
  "Northern Africa": "North Africa",
  "Western Africa": "West Africa",
  "Eastern Africa": "East Africa",
  "Southern Asia": "South Asia",
  "Eastern Asia": "East Asia",
  "South-Eastern Asia": "Southeast Asia",
  "Western Asia": "the Middle East",
  "Northern America": "North America",
  Americas: "the Americas",
};
// In a sentence ("in the Middle East"), or bare for a label or hashtag ("Middle East").
export const regionName = (r, { bare = false } = {}) => {
  const n = FRIENDLY_REGIONS[r] || r;
  return bare ? n.replace(/^the /, "") : n;
};

// ---- facts ----
const ordinal = (n) => { const v = n % 100; return `${n}${["th", "st", "nd", "rd"][v >= 11 && v <= 13 ? 0 : n % 10 < 4 ? n % 10 : 0]}`; };
const N = sovereign.length;
const rankBy = (c, f, pool = sovereign) => 1 + pool.filter((x) => f(x) > f(c)).length; // 1 = the highest value
const areaOf = (x) => x.area, popOf = (x) => x.population, densityOf = (x) => x.population / x.area;
const gdpPerPerson = (x) => (x.gdp?.value && x.population ? x.gdp.value / x.population : 0);
const joinNames = (names) => (names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const num = (n) => Math.round(n).toLocaleString("en-US");
export const isMicrostate = (c) => c.area < 1000;

// Landlocked, proven from our own shape data (data/countries-50m.json): a country none of whose outline is free coast, because every
// stretch of it is shared with a neighbour. Only countries the shapes prove are listed; the Caspian states and a few whose borders are
// cut by disputed areas are left out rather than guessed.
const landlocked = (() => {
  const topo = JSON.parse(fs.readFileSync(path.join(ROOT, "data/countries-50m.json"), "utf8"));
  const geoms = topo.objects.countries.geometries;
  const flat = (a) => (Array.isArray(a) ? a.flatMap(flat) : [a]);
  const arcs = geoms.map((g) => [...new Set(flat(g.arcs).map((i) => (i < 0 ? ~i : i)))]);
  const users = new Map();
  arcs.forEach((set) => set.forEach((i) => users.set(i, (users.get(i) || 0) + 1)));
  const byNumeric = new Map(all.map((c) => [c.numericCode, c]));
  const out = new Set();
  geoms.forEach((g, i) => {
    const c = byNumeric.get(String(g.id).padStart(3, "0"));
    if (c?.sovereign && arcs[i].every((a) => users.get(a) >= 2)) out.add(c.alpha3Code);
  });
  return out;
})();
// A landlocked country with a single neighbour lies wholly inside it (Vatican City and San Marino in Italy, Lesotho in South Africa).
const surroundedBy = (c) => (landlocked.has(c.alpha3Code) && c.borders?.length === 1 ? sovereign.find((x) => x.alpha3Code === c.borders[0]) : null);
const neighbourCodes = (c) => [...new Set((c.borders || []).map((code) => all.find((x) => x.alpha3Code === code)).filter(Boolean).map((x) => (x.sovereign ? x.alpha3Code : x.parent?.of)).filter((code) => code && code !== c.alpha3Code))];

// Candidate "did you know" facts with a score for how striking each is. Every one is derived from data/countries.json or the shape data.
export function funFacts(c) {
  const name = T.sentenceName(c);
  const out = [];
  const add = (score, text) => out.push({ score, text });

  const inside = sovereign.filter((x) => surroundedBy(x)?.alpha3Code === c.alpha3Code);
  if (inside.length) add(100, `${name} completely surrounds ${inside.length === 1 ? "another country" : `${inside.length} other countries`}: ${joinNames(inside.map(nameOf))}.`);
  const host = surroundedBy(c);
  if (host) add(98, `${name} lies completely inside ${T.nameWithThe(host)}, its only neighbour.`);

  const stats = [
    [popOf, "most populous country in the world", "least populous country in the world"],
    [areaOf, "largest country in the world by area", "smallest country in the world by area"],
  ];
  for (const [f, top, bottom] of stats) {
    const r = rankBy(c, f), low = N + 1 - r;
    if (r <= 3) add(95 - r, r === 1 ? `The ${top}.` : `The ${ordinal(r)} ${top}.`);
    else if (r <= 10) add(75, `The ${ordinal(r)} ${top}.`);
    if (low <= 3) add(95 - low, low === 1 ? `The ${bottom}.` : `The ${ordinal(low)} ${bottom}.`);
    else if (low <= 10) add(75, `The ${ordinal(low)} ${bottom}.`);
  }
  const dens = rankBy(c, densityOf);
  if (dens <= 8) add(72, `${dens === 1 ? "The most" : `The ${ordinal(dens)} most`} densely populated country in the world, with about ${num(densityOf(c))} people per km².`);
  if (N + 1 - dens <= 8) add(72, `One of the emptiest countries in the world, with about ${num(densityOf(c))} ${densityOf(c) < 2 ? "person" : "people"} per km².`);

  const nb = neighbourCodes(c).length;
  if (nb >= 8) {
    const more = sovereign.filter((x) => neighbourCodes(x).length > nb).length;
    add(70 + Math.min(nb, 14), `${name} borders ${nb} other countries${more ? `, and only ${more} ${more === 1 ? "country has" : "countries have"} more` : ", more than any other country"}.`);
  }
  if (landlocked.has(c.alpha3Code) && !host) add(64, `${name} is landlocked, with no coast on the sea.`);

  for (const [scope, key] of [["subregion", c.subregion], ["region", c.region]]) {
    const group = key ? sovereign.filter((x) => x[scope] === key) : [];
    if (group.length < 4) continue;
    const bonus = scope === "subregion" ? 4 : 0;
    const big = rankBy(c, areaOf, group), small = group.length + 1 - big;
    if (big === 1) add(62 + bonus, `The largest country in ${regionName(key)} by area.`);
    if (small === 1) add(62 + bonus, `The smallest country in ${regionName(key)} by area.`);
    if (rankBy(c, popOf, group) === 1 && big !== 1) add(58 + bonus, `The most populous country in ${regionName(key)}.`);
    if (group.length + 1 - rankBy(c, popOf, group) === 1 && small !== 1) add(58 + bonus, `The least populous country in ${regionName(key)}.`);
  }

  // Mid-tier facts, so a country with no extreme still gets something better than a density figure.
  if (c.subregion) {
    const group = sovereign.filter((x) => x.subregion === c.subregion);
    if (group.length >= 6) {
      const popRank = rankBy(c, popOf, group), areaRank = rankBy(c, areaOf, group);
      if (popRank >= 2 && popRank <= 3) add(54, `The ${ordinal(popRank)} most populous of the ${group.length} countries in ${regionName(c.subregion)}.`);
      if (areaRank >= 2 && areaRank <= 3) add(53, `The ${ordinal(areaRank)} largest of the ${group.length} countries in ${regionName(c.subregion)}, by area.`);
    }
  }
  const faith = c.religions?.[0];
  if (faith && faith.pct >= 75 && faith.name !== "Non-religious") add(52, `About ${Math.round(faith.pct)}% of people in ${T.nameWithThe(c)} follow ${faith.name}.`);
  else if (faith && faith.pct >= 55 && faith.name !== "Non-religious") add(48, `${faith.name} is the largest religion in ${T.nameWithThe(c)}, followed by about ${Math.round(faith.pct)}% of people.`);
  // Further down the world rankings, still worth saying.
  for (const [f, top, bottom] of [[popOf, "most populous country in the world", "least populous country in the world"], [areaOf, "largest country in the world by area", "smallest country in the world by area"]]) {
    const r = rankBy(c, f), low = N + 1 - r;
    if (r > 10 && r <= 25) add(56, `The ${ordinal(r)} ${top}.`);
    if (low > 10 && low <= 25) add(56, `The ${ordinal(low)} ${bottom}.`);
  }
  const worldDensity = sovereign.reduce((s, x) => s + x.population, 0) / sovereign.reduce((s, x) => s + x.area, 0);
  if (densityOf(c) >= 2.5 * worldDensity) add(50, `${name} is ${(densityOf(c) / worldDensity).toFixed(1)} times as crowded as the world average, with about ${num(densityOf(c))} people per km².`);
  if (densityOf(c) <= 0.4 * worldDensity) add(50, `${name} is far emptier than the world average: about ${num(densityOf(c))} people per km², against ${num(worldDensity)} worldwide.`);
  const worldEconomy = c.gdp?.value ? rankBy(c, (x) => x.gdp?.value || 0) : null;
  if (worldEconomy && worldEconomy > 5 && worldEconomy <= 25) add(55, `The ${ordinal(worldEconomy)} largest economy in the world (GDP, ${c.gdp.year}).`);
  if (c.languages?.length === 2) add(50, `${name} has 2 official languages: ${joinNames(c.languages.map((l) => l.name.replace(/\s*\([^)]*\)\s*/g, " ").trim()))}.`);
  const neighbours = neighbourCodes(c).length;
  if (neighbours >= 5 && neighbours < 8) add(52, `${name} borders ${neighbours} other countries.`);
  const rich = c.gdp?.value ? rankBy(c, gdpPerPerson) : null;
  if (rich && rich <= 8) add(68, `One of the 8 richest countries per person, with a GDP of about $${num(gdpPerPerson(c))} each (${c.gdp.year}).`);
  const economy = c.gdp?.value ? rankBy(c, (x) => x.gdp?.value || 0) : null;
  if (economy && economy <= 5) add(68, `${economy === 1 ? "The largest" : `The ${ordinal(economy)} largest`} economy in the world (GDP, ${c.gdp.year}).`);

  if (c.languages?.length >= 3) add(60 + c.languages.length, `${name} has ${c.languages.length} official languages: ${joinNames(c.languages.map((l) => l.name.replace(/\s*\([^)]*\)\s*/g, " ").trim()))}.`);
  const code = c.currencies?.length === 1 ? c.currencies[0].code : null;
  const sharing = code ? sovereign.filter((x) => x.currencies?.some((k) => k.code === code)).length : 0;
  if (sharing >= 5) add(58, `${name} shares its currency, the ${c.currencies[0].name}, with ${sharing - 1} other countries.`);
  const gov = c.governmentType, sameGov = gov ? sovereign.filter((x) => x.governmentType === gov).length : 99;
  if (gov && sameGov <= 4) add(56, `Only ${sameGov} countries in our data are listed as ${gov === "absolute monarchy" ? "absolute monarchies" : `"${gov}"`}, and ${name} is one.`);
  if (nb === 0 && !host) add(50, `${name} has no land borders.`);

  if (!out.length || Math.max(...out.map((o) => o.score)) < 55) add(40, `About ${num(densityOf(c))} ${densityOf(c) < 2 ? "person lives" : "people live"} on each square kilometre of ${name}.`);
  return out.sort((x, y) => y.score - x.score);
}
// The most striking fact, picked at random among near-equals so repeat posts differ. The capital is never used: there is always something else.
export function funFact(c) {
  const facts = funFacts(c);
  return pick(facts.filter((f) => f.score >= facts[0].score - 6)).text;
}

// The fact as a caption hook that names the country, so it reads on its own outside the image. Facts that already name it pass through;
// fragments ("The 5th largest country...", "One of the emptiest...") become "Brazil is the 5th largest country...". The slide keeps the fragment.
export function hookLine(c, fact) {
  if (fact.toLowerCase().includes(nameOf(c).toLowerCase())) return fact;
  const name = T.sentenceName(c);
  if (/^(The|One of) /.test(fact)) return `${name} is ${fact[0].toLowerCase()}${fact.slice(1)}`;
  return fact;
}

export function languagesText(c) {
  const names = (c.languages || []).map((l) => l.name.replace(/\s*\([^)]*\)\s*/g, " ").trim()).filter(Boolean);
  if (!names.length) return "N/A";
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ");
}

// The five rows of the facts slide. Pass the fact already chosen so the slide and the caption use the very same sentence.
export function factRows(c, fact = funFact(c)) {
  return [
    ["Capital", c.capital || "N/A"],
    ["Population", `${T.formatPopulation(c.population)}${c.populationYear ? ` (${c.populationYear})` : ""}`],
    ["Languages", languagesText(c)],
    ["Area", T.formatArea(c.area)],
    ["Did you know?", fact],
  ];
}

// The country's flag as an emoji (two regional-indicator letters). Used in captions only; no emoji are ever drawn into an image.
export const flagEmoji = (c) => String.fromCodePoint(...[...c.alpha2Code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

// ---- maps ----
export function regionalMapFor(c) {
  for (const { id } of MAP_REGIONS) if (read(`maps/${id}/index.html`).includes(`data-code="${c.alpha3Code}"`)) return id;
  return null;
}
export function mapSvg(id) {
  const m = read(`maps/${id}/index.html`).match(/<svg class="map-svg"[\s\S]*?<\/svg>\s*<\/button>/);
  if (!m) throw new Error(`No map found in maps/${id}/index.html`);
  // Straight apostrophes in the labels (Côte d'Ivoire) become typographic ones; only text between tags is touched.
  return m[0].replace(/\s*<\/button>$/, "").replace(/>([^<>]*)</g, (all, t) => (t.includes("'") ? `>${t.replace(/'/g, "’")}<` : all));
}
// The country page's locator map: the country (and any disputed area beside it) framed on its own, with the neighbours and sea left out.
export function locatorSvg(c, { silhouette = false } = {}) {
  const html = read(`country/${countrySlug(c)}/index.html`);
  // The locator holds a nested inset <svg>, so cut from its opening tag to the inset's closing tag (or its own end when there is no inset).
  const open = html.indexOf('<svg class="country-map"');
  const inset = html.indexOf('<svg class="map-inset"', open);
  const outerClose = inset >= 0 && inset < html.indexOf("</svg>", open) ? html.indexOf("</svg>", html.indexOf("</svg>", inset) + 6) : html.indexOf("</svg>", open);
  let svg = html.slice(open, outerClose + 6);
  if (silhouette) svg = svg.replace(/<svg class="map-inset"[\s\S]*?<\/svg>/, "").replace(/<rect[^>]*class="map-sea"[^>]*\/>/, "").replace(/<path class="map-land"[^>]*\/>/, "").replace(/<rect[^>]*class="map-inset-frame"[^>]*\/>/, "");
  return svg;
}
export const hasRing = (c) => /map-ring/.test(locatorSvg(c));

// ---- quiz ----
// Wrong options are plausible: the same subregion first, then the region, then the world; the closest in size (area) first; and never a
// microstate (under 1,000 km²: Vatican City, Monaco, San Marino...) unless the right answer is one too.
export function distractors(c, getter, n = 3, pool = sovereign) {
  const right = getter(c);
  const micro = isMicrostate(c);
  const ok = (x) => x !== c && getter(x) && getter(x) !== right && (micro || !isMicrostate(x));
  const gap = (x) => Math.abs(Math.log(x.area) - Math.log(c.area));
  const near = (x) => x.subregion === c.subregion, same = (x) => x.region === c.region;
  // A microstate's options are other microstates first (nearby, then anywhere); everything else comes from the same part of the world.
  const tiers = micro
    ? [pool.filter((x) => ok(x) && isMicrostate(x) && near(x)), pool.filter((x) => ok(x) && isMicrostate(x) && same(x)), pool.filter((x) => ok(x) && isMicrostate(x)), pool.filter((x) => ok(x) && same(x)), pool.filter(ok)]
    : [pool.filter((x) => ok(x) && near(x)), pool.filter((x) => ok(x) && same(x)), pool.filter(ok)];
  const out = [];
  for (const tier of tiers) {
    // Choose among the closest in size, in random order, so the same country does not always get the same options.
    const closest = tier.sort((x, y) => gap(x) - gap(y)).slice(0, Math.max(n + 2, 5));
    for (const x of shuffle(closest)) if (out.length < n && !out.some((o) => getter(o) === getter(x))) out.push(x);
    if (out.length >= n) break;
  }
  return out;
}
export function quizPool(type) {
  if (type === "capital") return sovereign.filter((c) => c.capital && !/[,/]/.test(c.capital));
  if (type === "outline") return sovereign.filter((c) => c.area >= 3000 && fs.existsSync(path.join(ROOT, "country", countrySlug(c), "index.html")) && !hasRing(c));
  return sovereign;
}
export function buildQuiz(type, c) {
  const getter = type === "capital" ? (x) => x.capital : nameOf;
  const wrong = distractors(c, getter);
  const options = shuffle([c, ...wrong]);
  return { type, country: c, options: options.map(getter), answerIndex: options.indexOf(c), letters: ["A", "B", "C", "D"] };
}

// ---- hashtags ----
// Instagram allows 5 hashtags: the two brand tags first, then up to 3 specific ones. Each is built from words (letters and digits only, one
// capital per word) and checked, so a typo or a stray character cannot get through.
const tag = (s) => "#" + slugify(s.replace(/^the /i, "")).split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
export function hashtags(specific = []) {
  const out = [];
  for (const t of ["#Geography", "#CountryFacts", ...specific.map((s) => (s.startsWith("#") ? s : tag(s)))]) {
    if (!/^#[A-Za-z0-9]{3,40}$/.test(t)) throw new Error(`Bad hashtag "${t}"`);
    if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 5).join(" ");
}
