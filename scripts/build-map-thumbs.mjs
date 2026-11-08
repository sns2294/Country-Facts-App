#!/usr/bin/env node
// Draws the hub page's card thumbnails (maps/thumbs/<id>-light.webp and <id>-dark.webp) from the regional maps' own pages,
// so they always match the maps: run it after scripts/build-maps.mjs.
//
//   node scripts/build-map-thumbs.mjs           draw the thumbnails whose map changed
//   node scripts/build-map-thumbs.mjs --check   exit 1 if any thumbnail is missing or out of date
//
// Each thumbnail is the map's SVG (the same markup, colors and labels) on a 4:3 canvas in the map's ocean color, so tall maps
// (South America) are not cropped and the canvas blends into its card. Google Chrome (headless) draws them, as for the preview
// images in og/ (see scripts/build-pages.mjs), then converts them to WebP in the same Chrome (no other tool needed); each map's hash is kept in
// maps/thumbs/manifest.json so only changed maps are redrawn.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ALL_MAPS } from "./map-regions.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = "maps/thumbs";
const W = 640, H = 480, WEBP_QUALITY = 0.82;
const OCEAN = { light: "#cfe6f2", dark: "#0f2233" }; // maps/maps.css (--ocean)
const CHROME = process.env.CHROME_PATH || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
const hash = (...texts) => { const h = crypto.createHash("sha1"); texts.forEach((t) => h.update(t)); return h.digest("hex").slice(0, 8); };
const CHECK = process.argv.includes("--check");

const manifestFile = path.join(ROOT, DIR, "manifest.json");
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : {};
const css = fs.readFileSync(path.join(ROOT, "maps/maps.css"), "utf8");
const todo = [];
for (const { id } of ALL_MAPS) {
  const page = fs.readFileSync(path.join(ROOT, "maps", id, "index.html"), "utf8");
  const svg = page.match(/<svg class="map-svg"[\s\S]*?<\/svg>\s*<\/button>/)?.[0].replace(/\s*<\/button>$/, "");
  if (!svg) throw new Error(`No map found in maps/${id}/index.html`);
  const [, vw, vh] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const scale = Math.min(W / vw, H / vh), w = Math.round(vw * scale), h = Math.round(vh * scale);
  for (const theme of ["light", "dark"]) {
    const file = `${DIR}/${id}-${theme}.webp`;
    // The card is the map on a canvas of its ocean color; the cached hash covers the markup, the styles and this layout.
    const html = `<!-- webp q${WEBP_QUALITY} --><!doctype html><html class="${theme === "dark" ? "dark" : ""}"><head><meta charset="utf-8"><style>${css}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
.maps-page{width:${W}px;height:${H}px;background:${OCEAN[theme]};display:flex;align-items:center;justify-content:center}
.maps-page .map-svg{display:block;width:${w}px;height:${h}px}</style></head><body><div class="maps-page">${svg}</div></body></html>`;
    const h8 = hash(html);
    if (manifest[file] !== h8 || !fs.existsSync(path.join(ROOT, file))) todo.push([file, html, h8]);
  }
}
if (CHECK) {
  if (todo.length) { console.error(`${todo.length} map thumbnail(s) are out of date. Run: node scripts/build-map-thumbs.mjs`); process.exit(1); }
  console.log("Map thumbnails are up to date.");
  process.exit(0);
}
if (!todo.length) { console.log("Map thumbnails are up to date."); process.exit(0); }
if (!CHROME) throw new Error("Google Chrome is needed to draw the thumbnails. Install it or set CHROME_PATH.");
fs.mkdirSync(path.join(ROOT, DIR), { recursive: true });
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "thumbs-"));
try {
  const pngs = [];
  for (const [file, html, h8] of todo) {
    const src = path.join(tmp, "thumb.html"), png = path.join(tmp, path.basename(file).replace(/\.webp$/, ".png"));
    fs.writeFileSync(src, html);
    execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${W},${H}`, `--screenshot=${png}`, `--user-data-dir=${path.join(tmp, "profile")}`, "file://" + src], { stdio: "pipe", timeout: 60000 });
    if (!fs.existsSync(png)) throw new Error(`Chrome did not draw ${file}`);
    pngs.push([file, png, h8]);
  }
  // PNG -> WebP: one more Chrome run loads the PNGs and re-encodes them on a canvas (it prints the results into the page).
  const conv = path.join(tmp, "convert.html");
  fs.writeFileSync(conv, `<!doctype html><meta charset="utf-8"><body>${pngs.map(([file, png]) => `<img src="file://${png}" data-n="${file}">`).join("")}<div id="out"></div><script>
window.addEventListener("load", () => { const out = document.getElementById("out"); for (const img of document.images) { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0); const i = document.createElement("i"); i.dataset.n = img.dataset.n; i.dataset.u = c.toDataURL("image/webp", ${WEBP_QUALITY}); out.appendChild(i); } });
</script>`);
  const dom = execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--allow-file-access-from-files", `--user-data-dir=${path.join(tmp, "profile2")}`, "--dump-dom", "file://" + conv], { encoding: "utf8", maxBuffer: 1 << 29, timeout: 120000, stdio: ["ignore", "pipe", "ignore"] });
  const encoded = new Map([...dom.matchAll(/data-n="([^"]+)" data-u="data:image\/webp;base64,([^"]+)"/g)].map((m) => [m[1], Buffer.from(m[2], "base64")]));
  for (const [file, , h8] of pngs) {
    if (!encoded.has(file)) throw new Error(`Chrome did not convert ${file} to WebP`);
    fs.writeFileSync(path.join(ROOT, file), encoded.get(file));
    manifest[file] = h8;
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
const current = new Set(ALL_MAPS.flatMap(({ id }) => ["light", "dark"].map((t) => `${DIR}/${id}-${t}.webp`)));
fs.writeFileSync(manifestFile, JSON.stringify(Object.fromEntries(Object.entries(manifest).filter(([f]) => current.has(f)).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");
console.log(`Drew ${todo.length} thumbnail(s) in ${DIR}/.`);
