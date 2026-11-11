#!/usr/bin/env node
// Launch day: makes the site indexable, rebuilds everything in the right order, checks it, shows you what changed and,
// only when you confirm, commits and pushes.
//
//   node scripts/launch.mjs             the real thing (asks before it commits and pushes)
//   node scripts/launch.mjs --dry-run   every step, then puts the repo back exactly as it was (no prompt, no commit)
//
// Needs: a clean working tree on the branch you publish from, Node 18+, and Google Chrome (for the thumbnails and preview
// images, only when they are out of date).
//
// What it does, in order, stopping at the first failure (and putting the repo back as it was):
//   1. checks the working tree is clean
//   2. sets "indexable": true in site.config.json
//   3. build-maps.mjs            the regional map pages
//   4. build-density-map.mjs     the population density map
//   5. build-map-thumbs.mjs      the hub's card pictures, drawn from those pages
//   6. stamp-version.mjs         cache-busting version strings (before the pages: index.html carries them, and sitemap.xml
//                                dates a page by its content)
//   7. build-pages.mjs           country pages, hub, 404, preview images, sitemap.xml, robots.txt
//   8. the checks: stamp-version --check, build-map-thumbs --check, build-pages --check (which also proves the map pages are
//      current), check-insets, check-disputed, check-links, then launch checks of its own: no page is noindex except the 404
//      page, robots.txt lists the sitemap, sitemap.xml lists every public page
//   9. shows the git diff summary and waits for you to type "launch"; then commits and pushes
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY_RUN = process.argv.includes("--dry-run");
const CONFIG = path.join(ROOT, "site.config.json");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const say = (msg = "") => console.log(msg);
const run = (cmd, args, { capture = true } = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: capture ? "pipe" : "inherit", maxBuffer: 1 << 28 });
const git = (...args) => run("git", args);
const script = (name, ...args) => run(process.execPath, [path.join("scripts", name), ...args]);

let touched = false; // whether the working tree may differ from the start
let step = 0;
const TOTAL = 14;

// Puts the working tree back exactly as it was: it started clean, so everything now changed or new came from this run.
function restore() {
  if (!touched) return;
  git("restore", "--source=HEAD", "--staged", "--worktree", "--", ".");
  git("clean", "-fdq");
  touched = false;
}

function fail(title, output = "") {
  say(`\nFAILED: ${title}`);
  const lines = String(output).trim().split("\n");
  if (lines.length && lines[0]) say(lines.slice(-25).join("\n"));
  restore();
  say("\nStopped. The repo has been put back exactly as it was; nothing was committed or pushed.");
  process.exit(1);
}

// One step: a name, and a function returning { ok, output } or a spawnSync result.
function stepRun(name, fn) {
  step += 1;
  process.stdout.write(`[${String(step).padStart(2)}/${TOTAL}] ${name} ... `);
  const t0 = Date.now();
  const r = fn();
  const ok = r.ok !== undefined ? r.ok : r.status === 0;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (!ok) {
    say(`FAILED (${secs}s)`);
    fail(name, typeof r.output === "string" ? r.output : `${r.stdout || ""}${r.stderr || ""}`);
  }
  const last = (typeof r.output === "string" ? r.output : String(r.stdout || "")).trim().split("\n").filter(Boolean).pop() || "";
  say(`ok (${secs}s)${last && last.length < 100 ? ` ${last}` : ""}`);
}

// ---- 1. preflight ----
say(DRY_RUN ? "Launch dry run: nothing will be committed, and the repo is put back at the end.\n" : "Launch: the site becomes indexable.\n");
if (!fs.existsSync(CONFIG)) fail("site.config.json not found");
const branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.trim();
const dirty = git("status", "--porcelain").stdout.trim();
step += 1;
process.stdout.write(`[${String(step).padStart(2)}/${TOTAL}] Working tree clean, on "${branch}" ... `);
if (dirty) {
  say("FAILED");
  say(`\nThe working tree has uncommitted changes. Commit or stash them first:\n${dirty.split("\n").slice(0, 10).join("\n")}`);
  process.exit(1);
}
say("ok");
if (!DRY_RUN) {
  const fetched = git("fetch", "origin", branch);
  const behind = fetched.status === 0 ? Number(git("rev-list", "--count", `HEAD..origin/${branch}`).stdout.trim() || 0) : 0;
  if (behind) {
    say(`\n"${branch}" is ${behind} commit(s) behind origin. Pull first.`);
    process.exit(1);
  }
}

// ---- 2. flip ----
const originalConfig = fs.readFileSync(CONFIG, "utf8");
const config = JSON.parse(originalConfig);
if (config.indexable === true) {
  say('\nsite.config.json already says "indexable": true. Nothing to launch.');
  process.exit(1);
}
stepRun('Set "indexable": true in site.config.json', () => {
  touched = true;
  fs.writeFileSync(CONFIG, JSON.stringify({ ...config, indexable: true }, null, 2) + "\n");
  return { ok: JSON.parse(read("site.config.json")).indexable === true, output: "" };
});

// ---- 3-7. builds ----
stepRun("Regional maps (build-maps.mjs)", () => script("build-maps.mjs"));
stepRun("Population density map (build-density-map.mjs)", () => script("build-density-map.mjs"));
stepRun("Hub thumbnails (build-map-thumbs.mjs)", () => script("build-map-thumbs.mjs"));
stepRun("Version strings (stamp-version.mjs)", () => script("stamp-version.mjs"));
stepRun("Pages, 404, previews, sitemap.xml, robots.txt (build-pages.mjs)", () => script("build-pages.mjs", "--no-map-builds"));

// ---- 8. checks ----
stepRun("stamp-version.mjs --check", () => script("stamp-version.mjs", "--check"));
stepRun("build-map-thumbs.mjs --check", () => script("build-map-thumbs.mjs", "--check"));
stepRun("build-pages.mjs --check (also rebuilds the map pages to prove them current)", () => script("build-pages.mjs", "--check"));
stepRun("check-insets.mjs", () => script("check-insets.mjs"));
stepRun("check-disputed.mjs", () => script("check-disputed.mjs"));
stepRun("check-links.mjs", () => script("check-links.mjs"));

stepRun("Launch checks: no noindex, robots.txt, sitemap.xml", () => {
  const problems = [];
  const pages = ["index.html", "country/index.html", "maps/index.html"];
  for (const d of fs.readdirSync(path.join(ROOT, "maps"), { withFileTypes: true })) if (d.isDirectory() && fs.existsSync(path.join(ROOT, `maps/${d.name}/index.html`))) pages.push(`maps/${d.name}/index.html`);
  for (const d of fs.readdirSync(path.join(ROOT, "country"), { withFileTypes: true })) if (d.isDirectory() && fs.existsSync(path.join(ROOT, `country/${d.name}/index.html`))) pages.push(`country/${d.name}/index.html`);
  const noindexed = pages.filter((p) => /<meta name="robots" content="[^"]*noindex/i.test(read(p)));
  if (noindexed.length) problems.push(`${noindexed.length} page(s) still say noindex: ${noindexed.slice(0, 5).join(", ")}`);
  if (!/<meta name="robots" content="[^"]*noindex/i.test(read("404.html"))) problems.push("404.html lost its noindex");
  const base = JSON.parse(read("site.config.json")).baseUrl.replace(/\/+$/, "");
  if (!read("robots.txt").includes(`Sitemap: ${base}/sitemap.xml`)) problems.push("robots.txt does not list the sitemap");
  const locs = new Set([...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const missing = pages.map((p) => `${base}/${p.replace(/index\.html$/, "")}`).filter((u) => !locs.has(u));
  if (missing.length) problems.push(`sitemap.xml is missing ${missing.length} page(s): ${missing.slice(0, 5).join(", ")}`);
  const extra = [...locs].filter((u) => !pages.some((p) => `${base}/${p.replace(/index\.html$/, "")}` === u));
  if (extra.length) problems.push(`sitemap.xml lists ${extra.length} URL(s) that are not pages: ${extra.slice(0, 5).join(", ")}`);
  return { ok: !problems.length, output: problems.length ? problems.join("\n") : `${pages.length} pages, all indexable and in the sitemap` };
});

// ---- 9. summary and confirmation ----
say("\nWhat changes:");
const changed = git("status", "--porcelain").stdout.trimEnd().split("\n").filter(Boolean).map((l) => l.slice(3));
const groups = {};
for (const f of changed) {
  const k = f.startsWith("country/") ? "country pages" : f.startsWith("maps/thumbs/") ? "map thumbnails" : f.startsWith("maps/") ? "map pages" : f.startsWith("og/") ? "preview images" : "other files";
  (groups[k] ??= []).push(f);
}
say(`  ${changed.length} file(s): ${Object.entries(groups).map(([k, v]) => `${v.length} ${k}`).join(", ")}`);
say(`  ${git("diff", "--shortstat").stdout.trim()}`);
const others = groups["other files"] || [];
if (others.length) say(`  other files: ${others.join(", ")}`);
say("\nsite.config.json and robots.txt:");
say(git("diff", "--", "site.config.json", "robots.txt").stdout.trim().split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l)).map((l) => `  ${l}`).join("\n"));
const sample = changed.find((f) => f.startsWith("country/") && f.endsWith("index.html"));
if (sample) say(`\nA country page (${sample}) differs only by:\n${git("diff", "-U0", "--", sample).stdout.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l)).map((l) => `  ${l.slice(0, 110)}`).join("\n")}`);

if (DRY_RUN) {
  say("\nDry run finished: every step and check passed. Putting the repo back...");
  restore();
  const after = git("status", "--porcelain").stdout.trim();
  const same = fs.readFileSync(CONFIG, "utf8") === originalConfig && !after;
  say(same ? "The repo is exactly as it was (clean tree, site.config.json unchanged)." : `WARNING: the repo is not clean after the restore:\n${after}`);
  process.exit(same ? 0 : 1);
}

if (!process.stdin.isTTY) {
  say("\nNo terminal to ask for confirmation, so nothing was committed. Putting the repo back.");
  restore();
  process.exit(1);
}
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await new Promise((resolve) => rl.question('\nType "launch" to commit and push, anything else to abort: ', resolve));
rl.close();
if (answer.trim() !== "launch") {
  restore();
  say("Aborted. The repo has been put back exactly as it was.");
  process.exit(1);
}
git("add", "-A");
const commit = git("commit", "-m", "Launch: make the site indexable\n\nindexable is true in site.config.json; every page drops its noindex tag, robots.txt lists the sitemap.");
if (commit.status !== 0) fail("git commit", commit.stdout + commit.stderr);
touched = false;
say(git("log", "--oneline", "-1").stdout.trim());
const push = run("git", ["push"], { capture: false });
if (push.status !== 0) {
  say("\nThe commit is made but the push failed. Fix the problem above and run: git push");
  process.exit(1);
}
say("\nPushed. GitHub Pages will publish in a minute or two. Then submit https://countryfacts.app/sitemap.xml in Google Search Console and Bing Webmaster Tools.");
