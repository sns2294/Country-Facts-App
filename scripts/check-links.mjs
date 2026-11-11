// Link checker for the generated pages: node scripts/check-links.mjs
//
// 1. Resolves every internal href/src on the home page, the 404 page, the country index, the maps hub, every map page and
//    every country page against the files in the repo, the way GitHub Pages would serve them (a folder link
//    means its index.html), and reports the ones that do not exist.
// 2. Resolves every absolute URL on the site's own base URL (site.config.json: canonical, og:url, og:image,
//    twitter:image, hreflang... and every <loc> in sitemap.xml) to a local file.
// 3. Warns about root-absolute links ("/maps/") and github.io / localhost URLs, which break when the site is
//    served from another place.
//
// Exits 1 if anything is broken (so it can gate a stress test or a launch-day check), 0 if clean.
// Offline and read-only: it never fetches anything.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8")).baseUrl.replace(/\/$/, "");

const subdirs = (dir, skip = []) =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !skip.includes(d.name))
    .map((d) => d.name);
const pages = [
  "index.html",
  "404.html",
  "country/index.html",
  "maps/index.html",
  ...subdirs("maps", ["thumbs"]).map((d) => `maps/${d}/index.html`),
  ...subdirs("country").map((d) => `country/${d}/index.html`),
].filter((p) => fs.existsSync(path.join(ROOT, p)));

// ---- internal links ----
let checked = 0, navOk = 0;
const bad = [], rootAbsolute = [];
for (const pg of pages) {
  const html = fs.readFileSync(path.join(ROOT, pg), "utf8");
  const dir = path.dirname(pg);
  for (const m of html.matchAll(/\s(?:href|src)="([^"#]*)(#[^"]*)?"/g)) {
    let u = m[1];
    if (!u || /^(https?:|mailto:|data:|javascript:)/.test(u)) continue;
    if (u.startsWith("/")) { rootAbsolute.push(`${pg} -> ${u}`); continue; }
    u = u.split("?")[0];
    let f = path.normalize(path.join(ROOT, dir, u));
    if (f.endsWith("/") || (fs.existsSync(f) && fs.statSync(f).isDirectory())) f = path.join(f, "index.html");
    checked++;
    if (!fs.existsSync(f)) bad.push(`${pg} -> ${m[1]}`);
  }
  if (/class="section-nav"/.test(html)) navOk++;
}
console.log(`pages scanned: ${pages.length} | internal links checked: ${checked} | broken: ${bad.length} | root-absolute (/...) links: ${rootAbsolute.length}`);
console.log(`pages with the section nav: ${navOk}`);
if (bad.length) console.log(bad.slice(0, 20).join("\n"));
if (rootAbsolute.length) console.log(rootAbsolute.slice(0, 5).join("\n"));

// ---- absolute URLs on the site's own base URL ----
const local = (u) => {
  const p = u.slice(BASE.length).split("#")[0].split("?")[0];
  const f = path.join(ROOT, p);
  return p.endsWith("/") || p === "" ? path.join(f, "index.html") : f;
};
let absChecked = 0;
const absBad = [], foreign = new Set();
for (const pg of [...pages, "sitemap.xml"]) {
  if (!fs.existsSync(path.join(ROOT, pg))) continue;
  const t = fs.readFileSync(path.join(ROOT, pg), "utf8");
  for (const m of t.matchAll(/(?:content|href|<loc>)="?(https?:\/\/[^"<\s]+)/g)) {
    const u = m[1];
    if (u.startsWith(BASE)) { absChecked++; if (!fs.existsSync(local(u))) absBad.push(`${pg} -> ${u}`); }
    else if (/github\.io|localhost/.test(u)) foreign.add(`${pg} -> ${u}`);
  }
  if (pg === "sitemap.xml") {
    for (const m of t.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      absChecked++;
      if (!m[1].startsWith(BASE) || !fs.existsSync(local(m[1]))) absBad.push(`sitemap -> ${m[1]}`);
    }
  }
}
console.log(`absolute ${BASE} links checked: ${absChecked} | not found locally: ${absBad.length} | github.io/localhost URLs: ${foreign.size}`);
if (absBad.length) console.log(absBad.slice(0, 10).join("\n"));
if (foreign.size) console.log([...foreign].slice(0, 5).join("\n"));

const failed = bad.length + absBad.length;
console.log(failed ? `FAILED: ${failed} broken link(s)` : "OK: no broken links");
process.exit(failed ? 1 : 0);
