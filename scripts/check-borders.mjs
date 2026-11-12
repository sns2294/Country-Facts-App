// Border-chip check: node scripts/check-borders.mjs [--list]
//
// 1. Data: every border chip the data produces (CountryText.getBorderChips, the same list the app's fact card and the
//    country pages use) must point at an entry that exists in data/countries.json, so the app can select it.
// 2. Pages: on every country page each chip in "Bordering countries" must be a real link (<a class="border-chip" href=...>):
//    a sovereign country with a page links to ../<slug>/ and that page must exist; any other entry links to the app with
//    ?country=<code>, and the code must resolve in data/countries.json. A chip that is a <span> (no link) fails.
// --list prints every chip whose target has no country page. Exits 1 on any failure. Offline and read-only.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const T = require(path.join(ROOT, "country-text.js"));
const all = JSON.parse(fs.readFileSync(path.join(ROOT, "data/countries.json"), "utf8"));
const byCode = new Map();
for (const c of all) { byCode.set(c.alpha3Code, c); if (c.alpha2Code) byCode.set(c.alpha2Code, c); }

const slugDirs = new Set(fs.readdirSync(path.join(ROOT, "country"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name));
const bad = [];
const noPage = [];

// Pages that exist, by country: read each page's own canonical-free name from the folder via the page's flag/heading is overkill;
// instead, trust the link target: a chip is "page-linked" when its href is ../<slug>/ with the folder present.
let chipsChecked = 0;
for (const c of all.filter((x) => x.sovereign)) {
  const data = T.getBorderChips(c, all);
  for (const chip of data) if (!byCode.has(chip.code)) bad.push(`${c.name}: chip "${chip.name}" has unknown code ${chip.code}`);
  const dir = [...slugDirs].find((d) => {
    const f = path.join(ROOT, "country", d, "index.html");
    return fs.existsSync(f) && fs.readFileSync(f, "utf8").includes(`href="../../?country=${c.alpha2Code.toLowerCase()}&amp;view=map"`);
  });
  if (!dir) { bad.push(`${c.name}: no country page found`); continue; }
  const html = fs.readFileSync(path.join(ROOT, "country", dir, "index.html"), "utf8");
  const section = (html.match(/<div class="borders-section"><h2[^>]*>[^<]*<\/h2><div class="borders-list">([\s\S]*?)<\/div>/) || [])[1] || "";
  const rendered = [...section.matchAll(/<(a|span)\s+class="border-chip"([^>]*)>/g)];
  if (rendered.length !== data.length) bad.push(`${c.name}: page shows ${rendered.length} border chips, data has ${data.length}`);
  for (const m of rendered) {
    chipsChecked++;
    const href = (m[2].match(/href="([^"]*)"/) || [])[1];
    const label = (section.slice(m.index).match(/>([^<]*)/) || [])[0];
    if (m[1] !== "a" || !href) { bad.push(`${c.name}: chip is not a link (${m[0]})`); continue; }
    const app = href.match(/^\.\.\/\.\.\/\?country=([a-z]{2,3})$/);
    const page = href.match(/^\.\.\/([a-z0-9-]+)\/$/);
    if (page) { if (!fs.existsSync(path.join(ROOT, "country", page[1], "index.html"))) bad.push(`${c.name}: chip links to missing page ${href}`); }
    else if (app) { if (!byCode.has(app[1].toUpperCase())) bad.push(`${c.name}: chip links to unknown code ${href}`); else noPage.push(`${c.name} → ${byCode.get(app[1].toUpperCase()).name} (${href})`); }
    else bad.push(`${c.name}: chip has an unusable href ${href}`);
  }
}
if (process.argv.includes("--list")) console.log(noPage.join("\n"));
if (bad.length) { console.error(`check-borders: ${bad.length} problem(s)\n` + bad.join("\n")); process.exit(1); }
console.log(`check-borders: ${chipsChecked} border chips on country pages all have a working target (${noPage.length} open the app).`);
