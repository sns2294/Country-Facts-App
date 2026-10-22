// Adds content-hash version strings to the URLs of the files the page loads, so
// a changed file always gets a new URL and is never served from an old cache:
//   - index.html: ?v=<hash> on style.css and the app's own scripts
//   - app.js: DATA_VERSION, appended to the data and map fetches
// A file that hasn't changed keeps its URL, so caching still works as before
// (on GitHub Pages too). Run it after changing any of those files, before
// committing:
//
//   node scripts/stamp-version.mjs           # rewrite the version strings
//   node scripts/stamp-version.mjs --check   # exit 1 if they are out of date
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f));
const hash = (...buffers) => {
  const h = crypto.createHash("sha1");
  buffers.forEach((b) => h.update(b));
  return h.digest("hex").slice(0, 8);
};

const DATA_VERSION_RE = /(const DATA_VERSION = ")[0-9a-f]*(")/;
const DATA_FILES = [
  "data/countries.json",
  "data/meta.json",
  "data/countries-50m.json",
  "data/countries-50m-full.json",
  "world-map.svg",
];
const HTML_ASSETS = ["style.css", "shape-rules.js", "country-text.js", "language-quiz.js", "app.js"];

const dataVersion = hash(...DATA_FILES.map(read));

// app.js's own hash ignores the DATA_VERSION value, which this script rewrites.
let appJs = read("app.js").toString("utf8");
appJs = appJs.replace(DATA_VERSION_RE, `$1${dataVersion}$2`);
const appHash = hash(Buffer.from(appJs.replace(DATA_VERSION_RE, "$1$2")));

let html = read("index.html").toString("utf8");
for (const asset of HTML_ASSETS) {
  const v = asset === "app.js" ? appHash : hash(read(asset));
  const re = new RegExp(`((?:href|src)=")${asset.replace(".", "\\.")}(?:\\?v=[0-9a-f]*)?(")`);
  if (!re.test(html)) throw new Error(`index.html does not reference ${asset}`);
  html = html.replace(re, `$1${asset}?v=${v}$2`);
}

const changed = [];
if (appJs !== read("app.js").toString("utf8")) changed.push("app.js");
if (html !== read("index.html").toString("utf8")) changed.push("index.html");

if (process.argv.includes("--check")) {
  if (changed.length) {
    console.error(`Version strings are out of date (${changed.join(", ")}). Run: node scripts/stamp-version.mjs`);
    process.exit(1);
  }
  console.log("Version strings are up to date.");
} else {
  fs.writeFileSync(path.join(ROOT, "app.js"), appJs);
  fs.writeFileSync(path.join(ROOT, "index.html"), html);
  console.log(changed.length ? `Updated ${changed.join(", ")}` : "Already up to date.");
}
