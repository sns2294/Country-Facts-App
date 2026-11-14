#!/usr/bin/env node
// Instagram post generator (not part of the public site; output goes to instagram-posts/, which is in .gitignore).
//
//   node scripts/instagram/make.mjs country [code]        country of the day: 2 slides + caption.txt
//   node scripts/instagram/make.mjs quiz <outline|flag|capital> [code]   quiz post: question slide, answer slide, caption.txt
//   node scripts/instagram/make.mjs map <map-id>          a map fitted to 4:5 with its title, plus caption.txt
//   node scripts/instagram/make.mjs week                  one of each (country, quiz, map) into instagram-posts/<date>-week/
//
// Images are 1080x1350 PNGs in the site's dark style, drawn by headless Chrome from our own maps, country pages and flag-icons flags
// (MIT); the disputed-area rules are the site's because the maps and locator shapes are the site's own. No emoji are drawn into images.
//
// Captions: only the first ~125 characters show before "more", so line 1 is the hook (the standout fact, or the question), then the
// details, then the call to action, then at most 5 hashtags (#Geography #CountryFacts and up to 3 specific ones).
import fs from "node:fs";
import path from "node:path";
import { ROOT, T, ALL_MAPS, sovereign, nameOf, findCountry, pick, regionName, factRows, funFact, hookLine, flagEmoji, regionalMapFor, mapSvg, locatorSvg, quizPool, buildQuiz, hashtags } from "./data.mjs";
import { VIEWS } from "./sections.mjs";
import { countryMapSlide, factsSlide, quizQuestionSlide, quizAnswerSlide, mapSlide, renderSlides } from "./slides.mjs";

const OUT = path.join(ROOT, "instagram-posts");
const today = new Date().toISOString().slice(0, 10);
const CTA = "More at countryfacts.app, link in bio";
const OCEAN = "#0f2233";
// A short hashtag for the map with a long name (the full name would make a 30-character tag).
const MAP_TAG = { "central-america-caribbean": "Caribbean Map" };
// The regional hashtag words: the subregion, unless it is a compound ("Australia and New Zealand"), then the region.
const regionWords = (c) => regionName(c.subregion && !/ and /.test(c.subregion) ? c.subregion : c.region, { bare: true });

// The friendly one-liner under each map's hook (the app's own blurbs are more technical).
const MAP_LINES = {
  europe: "Every country from Iceland to Russia, including the tiny ones you might forget. 👀",
  africa: "All 54 countries, from Morocco to South Africa, plus every island nation. Can you find them all? 🌍",
  "middle-east": "From Turkey to Yemen and Egypt to the Caucasus: how many can you place without peeking? 🧭",
  "central-asia": "The six “-stans” in the heart of Asia. Quick: which is which? 🏔️",
  "south-asia": "India and all its neighbors, from the Himalayas to the Maldives. Can you place them all? 🗺️",
  "east-asia": "China, Japan, Mongolia, the Koreas and Taiwan: do you know who sits where? 🏯",
  "southeast-asia": "From Myanmar to Timor-Leste, a region of islands and peninsulas. Can you name all 11? 🌴",
  "north-america": "Canada, the United States and Mexico, plus Hawaii tucked into its own corner. 🍁",
  "central-america-caribbean": "The land bridge and the island chains: a crowd of small countries packed into one map. 🏝️",
  "south-america": "All 12 countries, plus a few territories you might not expect. 🌎",
  oceania: "Australia, New Zealand and the Pacific islands, scattered across the world’s biggest ocean. 🌊",
  "population-density": "Shaded by how many people live on each square kilometer. The crowded spots may surprise you. 👀",
};

function write(dir, slides, caption) {
  renderSlides(slides.map((html, i) => ({ html, out: path.join(dir, `slide-${i + 1}.png`) })));
  fs.writeFileSync(path.join(dir, "caption.txt"), caption.trim() + "\n");
  console.log(`${path.relative(ROOT, dir)}/  (${slides.length} slides + caption.txt)`);
}

function countryPost(code, base = OUT) {
  const c = code ? findCountry(code) : pick(sovereign);
  const mapId = regionalMapFor(c);
  const first = countryMapSlide(c, mapId ? mapSvg(mapId) : null, mapId ? null : locatorSvg(c));
  const fact = funFact(c); // chosen once: the hook line and the slide's "Did you know?" are this very sentence
  const rows = factRows(c, fact);
  const caption = `${hookLine(c, fact)} ${flagEmoji(c)}

Country of the day: ${nameOf(c)}
${rows.slice(0, 4).map(([k, v]) => `• ${k}: ${v}`).join("\n")}

${CTA}.

${hashtags([nameOf(c), regionWords(c), c.region])}`;
  write(path.join(base, `${today}-country-${c.alpha3Code.toLowerCase()}`), [first, factsSlide(c, rows)], caption);
}

function quizPost(type, code, base = OUT) {
  if (!["outline", "flag", "capital"].includes(type)) throw new Error("Quiz types: outline, flag, capital");
  const c = code ? findCountry(code) : pick(quizPool(type));
  if (type === "capital" && !c.capital) throw new Error(`${nameOf(c)} has no capital in the data`);
  const q = buildQuiz(type, c);
  const hook = {
    outline: "Can you name this country from its outline? 🤔",
    flag: "Can you name this country from its flag? 🤔",
    capital: `Do you know the capital of ${T.nameWithThe(c)}? 🤔`,
  }[type];
  const locator = type === "outline" ? locatorSvg(c, { silhouette: true }) : null;
  const fact = funFact(c); // a standout fact; the capital is not repeated here
  // No country or region hashtag: on a quiz it would give the answer away.
  const caption = `${hook} Answer in the next slide 👉

${q.options.map((o, i) => `${q.letters[i]}) ${o}`).join("\n")}

${CTA}.

${hashtags([`${type === "outline" ? "Map" : type === "flag" ? "Flag" : "Capital"} Quiz`, "Geography Quiz", "Trivia"])}`;
  write(path.join(base, `${today}-quiz-${type}-${c.alpha3Code.toLowerCase()}`), [quizQuestionSlide(q, locator), quizAnswerSlide(q, fact)], caption);
}

function mapPost(id, base = OUT) {
  const m = ALL_MAPS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown map "${id}". Maps: ${ALL_MAPS.map((x) => x.id).join(", ")}`);
  const v = VIEWS[id];
  if (!v) throw new Error(`No crop and sections for "${id}" in scripts/instagram/sections.mjs`);
  const svg = mapSvg(id), n = v.sections.length + 1;
  const slides = [mapSlide(m.name, m.kind || "Political map", svg, OCEAN, v.start, `1/${n}`), ...v.sections.map((sec, i) => mapSlide(m.name, sec.name, svg, OCEAN, sec, `${i + 2}/${n}`))];
  const hook = id === "population-density" ? "Which places on Earth are the most crowded? 🗺️ Swipe to zoom in 👉" : `How many countries on this map of ${m.name} can you name? 🗺️ Swipe to zoom in 👉`;
  const caption = `${hook}

${MAP_LINES[id] || m.blurb}
Zoomed in on: ${v.sections.map((s) => s.name).join("; ")}.

${CTA}.

${hashtags(m.kind ? [m.name, "World Map", "Data Visualization"] : [MAP_TAG[id] || `${m.name} Map`, "Political Map", "Maps"])}`;
  write(path.join(base, `${today}-map-${id}`), slides, caption);
}

const [cmd, a, b, d] = process.argv.slice(2);
try {
  if (cmd === "country") countryPost(a);
  else if (cmd === "quiz") quizPost(a, b);
  else if (cmd === "map") mapPost(a);
  else if (cmd === "week") {
    const base = path.join(OUT, `${today}-week`);
    const [qType, qCode] = d ? d.split(":") : [];
    countryPost(b && b !== "-" ? b : null, base);
    quizPost(qType || pick(["outline", "flag", "capital"]), qCode, base);
    mapPost(a || pick(ALL_MAPS).id, base);
  } else {
    console.error("Usage: make.mjs country [code] | quiz <outline|flag|capital> [code] | map <map-id> | week [map-id|-] [country|-] [quiz-type[:code]]");
    process.exit(2);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
