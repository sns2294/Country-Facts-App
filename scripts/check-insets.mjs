// Checks every generated country page: the whole country (and its ring, if it has
// one) must sit inside the locator inset with a small margin, so no inset cuts a
// country off. It reads the built HTML, not the builder's own bookkeeping.
//
//   node scripts/check-insets.mjs        # exit 1 and list the pages that fail
//
// A piece of the shape that lies wholly outside the inset is fine only if a copy of
// it one world to the left or right (the date-line copy) lies inside.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARGIN = 0.01; // of the view's narrower side, a little under the builder's own margin
const WORLD = 360 * 4; // one world in the inset's units (K = 4)

const failures = [];
const slugs = fs.readdirSync(path.join(ROOT, "country"), { withFileTypes: true }).filter((d) => d.isDirectory());
for (const { name: slug } of slugs) {
  const html = fs.readFileSync(path.join(ROOT, "country", slug, "index.html"), "utf8");
  const inset = html.match(/<svg class="map-inset"[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/);
  if (!inset) {
    failures.push(`${slug}: no inset`);
    continue;
  }
  const [vx, vy, vw, vh] = inset[1].split(/\s+/).map(Number);
  // The inset's box must have the view's shape, or the view is cropped to fill it.
  const [boxW, boxH] = [inset[0].match(/ width="(\d+)"/)[1], inset[0].match(/ height="(\d+)"/)[1]].map(Number);
  if (Math.abs(boxW / boxH / (vw / vh) - 1) > 0.01) failures.push(`${slug}: the inset box (${boxW}x${boxH}) is not the shape of its view (${vw}x${vh}), so the view is cropped`);
  const m = MARGIN * Math.min(vw, 1.68 * vh);
  // The world view wraps all the way round, so only latitude can leave it.
  const around = vw >= WORLD;
  const inside = ([x0, y0, x1, y1]) => (around || (x0 >= vx + m && x1 <= vx + vw - m)) && y0 >= vy + m && y1 <= vy + vh - m;

  const d = inset[2].match(/class="inset-country" d="([^"]*)"/)?.[1] ?? "";
  const pieces = (d.match(/M[^M]*/g) || []).map((sub) => {
    const pts = sub.match(/-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?/g).map((p) => p.split(/\s+/).map(Number));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });
  if (!pieces.length) failures.push(`${slug}: inset has no country shape`);
  for (const box of pieces) {
    if (inside(box)) continue;
    const copies = [-WORLD, WORLD].map((sh) => [box[0] + sh, box[1], box[2] + sh, box[3]]);
    // Fully outside the view, with its date-line copy shown instead: fine.
    if (around) {
      failures.push(`${slug}: a piece of the shape leaves the world inset at the top or bottom (y ${box[1]}..${box[3]})`);
      break;
    }
    const outside = (b) => b[2] < vx || b[0] > vx + vw || b[3] < vy || b[1] > vy + vh;
    if (outside(box) && copies.some(inside)) continue;
    failures.push(`${slug}: a piece of the shape leaves the inset (x ${box[0]}..${box[2]}, y ${box[1]}..${box[3]}, view ${inset[1]})`);
    break;
  }

  const ring = inset[2].match(/<circle class="inset-ring" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
  if (ring) {
    const [cx, cy, r] = ring.slice(1).map(Number);
    if (!inside([cx - r, cy - r, cx + r, cy + r])) failures.push(`${slug}: the inset's ring leaves the inset`);
  }
}

if (failures.length) {
  console.error(`${failures.length} page(s) with an inset that cuts the country off:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log(`All ${slugs.length} insets hold the whole country.`);
