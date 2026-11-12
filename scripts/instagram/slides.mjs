// HTML for each Instagram slide (1080x1350, the site's dark style) and the headless-Chrome step that turns it into a PNG.
// No emoji are drawn: the icon is favicon-192.png and every other mark is text, SVG or a flag from flag-icons (MIT).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, read, nameOf, T } from "./data.mjs";

export const W = 1080, H = 1350;
const CHROME = process.env.CHROME_PATH || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => fs.existsSync(p));
// Typographic apostrophes and quotes (’ “ ”) for everything drawn into an image, then HTML-escaped.
const typo = (s) => String(s).replace(/(^|[\s(\[\u2014-])"/g, "$1\u201C").replace(/"/g, "\u201D").replace(/(^|[\s(\[\u2014-])'/g, "$1\u2018").replace(/'/g, "\u2019");
const esc = (s) => typo(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const b64 = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(ROOT, file)).toString("base64")}`;
const ICON = b64("favicon-192.png", "image/png");
export const flagUri = (c) => b64(c.flags.svg, "image/svg+xml");
const MAPS_CSS = read("maps/maps.css");

const CSS = `
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:radial-gradient(1100px 650px at 20% 0%,#1a2236 0%,#12141c 70%);color:#eef0f3;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;position:relative}
.accent{position:absolute;left:0;top:0;bottom:0;width:12px;background:#ffb02e}
.brand{position:absolute;left:64px;top:44px;display:flex;align-items:center;gap:16px;font-size:34px;font-weight:700;letter-spacing:-.01em}
.brand img{width:60px;height:60px}
.url{position:absolute;left:64px;bottom:42px;font-size:30px;color:#9aa2ad}
.count{position:absolute;right:64px;bottom:42px;font-size:30px;color:#9aa2ad}
.kicker{font-size:30px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#ffb02e}
h1{font-weight:800;letter-spacing:-.03em;line-height:1.02}
.panel{position:absolute;left:64px;right:64px;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.5);outline:2px solid rgba(255,255,255,.12)}
.flagbox{display:flex;align-items:center;justify-content:center}
.flag{display:block;max-width:100%;max-height:100%;border-radius:14px;box-shadow:0 10px 36px rgba(0,0,0,.55);outline:2px solid rgba(255,255,255,.16)}
.sub{color:#9aa2ad}
.opt{display:flex;align-items:center;gap:26px;padding:0 34px;border-radius:22px;background:#1e2433;border:2px solid rgba(255,255,255,.12);font-size:44px;font-weight:600}
.opt b{flex:none;width:68px;height:68px;border-radius:50%;background:#ffb02e;color:#12141c;display:flex;align-items:center;justify-content:center;font-size:38px}
.opt.right{background:#ffb02e;color:#12141c;border-color:#ffb02e}.opt.right b{background:#12141c;color:#ffb02e}
.hatch-base{fill:#9db4cb}.hatch-line{stroke:#0b1d30;stroke-width:1}
`;
const frame = (inner, { page = "", css = "", mapsCss = false } = {}) => `<!doctype html><html class="dark"><meta charset="utf-8"><style>${mapsCss ? MAPS_CSS : ""}${CSS}${css}</style><div class="accent"></div><div class="brand"><img src="${ICON}" alt=""><span>Country Facts</span></div>${inner}<div class="url">countryfacts.app</div>${page ? `<div class="count">${page}</div>` : ""}`;

// ---- map panels ----
const MAP_BASE = `
.map-svg{display:block;width:100%;height:100%}
.map-svg .ocean{fill:#0f2233}.map-svg .lakes path{fill:#0f2233}`;
// The country slide shows the shapes only; a map post keeps the map's own labels.
const MAP_OVERRIDES = `${MAP_BASE}
.map-svg .seas,.map-svg .labels,.map-svg .callouts,.map-svg .capitals,.map-svg .lake-names{display:none}`;
const hlCss = `
.map-svg .c{fill:#2a3550;stroke:#0f1626;stroke-width:.8}
.map-svg .c.ctx{fill:#232b40}
.map-svg .c.hl{fill:#ffb02e;stroke:#0b1d30;stroke-width:1.4}
.map-svg .halo{fill:none;stroke:#ffb02e;stroke-width:5}`;

// Slide 1 of "country of the day": the country in amber on its regional map, zoomed in when it is small.
export function countryMapSlide(c, mapSvgMarkup, locator) {
  const flag = flagUri(c);
  const code = c.alpha3Code;
  const panel = { x: 64, y: 140, w: 952, h: 840 };
  const map = mapSvgMarkup || "";
  const body = `
<div class="panel maps-page" style="top:${panel.y}px;height:${panel.h}px;background:#0f2233" id="panel">${map || locator}</div>
<div style="position:absolute;left:64px;right:64px;top:${panel.y + panel.h + 44}px;display:flex;align-items:center;gap:36px">
  <div class="flagbox" style="width:230px;height:154px;flex:none"><img class="flag" src="${flag}" alt=""></div>
  <div><div class="kicker">Country of the day</div><h1 style="font-size:${nameOf(c).length > 16 ? 64 : 84}px;margin-top:10px">${esc(nameOf(c))}</h1><div class="sub" style="font-size:34px;margin-top:10px">${esc(c.subregion || c.region)}</div></div>
</div>`;
  const css = `${MAP_OVERRIDES}${hlCss}`;
  const script = map ? `<script>
const svg=document.querySelector(".map-svg"),vb=svg.viewBox.baseVal,pw=${panel.w},ph=${panel.h},A=pw/ph;
const hl=[...svg.querySelectorAll('path.c[data-code="${code}"]')];
if(hl.length){hl.forEach(p=>p.classList.add("hl"));
 const b=hl[0].getBBox();const cx=b.x+b.width/2,cy=b.y+b.height/2;
 const want=Math.max(b.width,b.height*A)*2.4;
 let fw=Math.min(vb.width,Math.max(want,vb.width/4)),fh=fw/A;
 if(fh>vb.height){fh=vb.height;fw=fh*A}
 const fx=fw>=vb.width?(vb.width-fw)/2:Math.min(Math.max(cx-fw/2,0),vb.width-fw),fy=fh>=vb.height?(vb.height-fh)/2:Math.min(Math.max(cy-fh/2,0),vb.height-fh);
 svg.setAttribute("viewBox",[fx,fy,fw,fh].join(" "));
 if(Math.max(b.width,b.height)<fw*0.07){const r=fw*0.05;const ring=document.createElementNS("http://www.w3.org/2000/svg","circle");ring.setAttribute("class","halo");ring.setAttribute("cx",cx);ring.setAttribute("cy",cy);ring.setAttribute("r",r);ring.setAttribute("stroke-width",fw*0.006);svg.appendChild(ring)}}
</script>` : "";
  return `${frame(body, { page: "1/2", css, mapsCss: !!map })}${script}`;
}

// Slide 2: the facts.
export function factsSlide(c, rows) {
  const flag = flagUri(c);
  const list = rows.map(([k, v], i) => `<div style="padding:34px 0;border-top:${i ? "2px solid rgba(255,255,255,.1)" : "0"}"><div class="kicker" style="font-size:24px;color:#ffb02e">${esc(k)}</div><div style="font-size:${String(v).length > 60 ? 46 : 60}px;font-weight:700;margin-top:8px;line-height:1.18">${esc(v)}</div></div>`).join("");
  const body = `
<div style="position:absolute;left:64px;right:64px;top:140px;display:flex;align-items:center;gap:32px"><div class="flagbox" style="width:150px;height:100px;flex:none"><img class="flag" src="${flag}" alt=""></div><h1 style="font-size:${nameOf(c).length > 16 ? 56 : 72}px">${esc(nameOf(c))}</h1></div>
<div style="position:absolute;left:64px;right:64px;top:300px">${list}</div>`;
  return frame(body, { page: "2/2" });
}

// ---- quiz ----
function optionsHtml(q, top, reveal, pitch = 124) {
  return q.options.map((o, i) => `<div class="opt${reveal && i === q.answerIndex ? " right" : ""}" style="position:absolute;left:64px;right:64px;top:${top + i * pitch}px;height:${pitch - 24}px"><b>${q.letters[i]}</b><span>${esc(o)}</span></div>`).join("");
}
export function quizQuestionSlide(q, locator) {
  const c = q.country;
  const titles = { outline: ["Name this country", "Which country has this outline?"], flag: ["Whose flag is this?", "Pick the country."], capital: [`What's the capital of`, ""] };
  const [title] = titles[q.type];
  let visual = "", optTop = 740, pitch = 124;
  if (q.type === "outline") {
    visual = `<div style="position:absolute;left:64px;right:64px;top:290px;height:420px"><div class="silo" style="height:100%">${locator}</div></div>`;
  } else if (q.type === "flag") {
    visual = `<div class="flagbox" style="position:absolute;left:64px;right:64px;top:290px;height:420px"><img class="flag" src="${flagUri(c)}" alt="" style="max-height:420px"></div>`;
  } else {
    visual = `<h1 style="position:absolute;left:64px;right:64px;top:290px;font-size:${nameOf(c).length > 14 ? 96 : 120}px;color:#ffb02e">${esc(nameOf(c))}?</h1>`;
    optTop = 540;
    pitch = 170;
  }
  const head = `<div style="position:absolute;left:64px;right:64px;top:140px"><div class="kicker">Quiz</div><h1 style="font-size:78px;margin-top:10px">${esc(title)}</h1></div>`;
  const tighten = q.type === "outline" ? `<script>const s=document.querySelector(".silo svg");if(s){const els=[...s.querySelectorAll(".map-country,.map-disputed,.map-dots")];let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const e of els){const b=e.getBBox();x0=Math.min(x0,b.x);y0=Math.min(y0,b.y);x1=Math.max(x1,b.x+b.width);y1=Math.max(y1,b.y+b.height)}const p=Math.max(x1-x0,y1-y0)*0.04;s.setAttribute("viewBox",[x0-p,y0-p,x1-x0+2*p,y1-y0+2*p].join(" "));s.setAttribute("preserveAspectRatio","xMidYMid meet")}</script>` : "";
  return frame(`${head}${visual}${optionsHtml(q, optTop, false, pitch)}`, { page: "1/2", css: `.silo .map-country{fill:#ffb02e;stroke:#0b1d30;stroke-width:2;stroke-linejoin:round}.silo .map-disputed{fill:url(#disputed-hatch);stroke:#0b1d30;stroke-width:1.4}.silo .map-dots circle{fill:#ffb02e;stroke:#0b1d30;stroke-width:1.4}.silo svg{height:100%;width:100%}` }) + tighten;
}
export function quizAnswerSlide(q, fact) {
  const c = q.country;
  const label = q.type === "capital" ? `The capital of ${T.nameWithThe(c)} is` : "It's";
  const answer = q.type === "capital" ? c.capital : nameOf(c);
  const body = `
<div style="position:absolute;left:64px;right:64px;top:150px"><div class="kicker">Answer</div><div class="sub" style="font-size:40px;margin-top:18px">${esc(label)}</div><h1 style="font-size:${answer.length > 14 ? 92 : 116}px;margin-top:6px;color:#ffb02e">${esc(answer)}</h1></div>
<div class="flagbox" style="position:absolute;left:64px;right:64px;top:490px;height:300px"><img class="flag" src="${flagUri(c)}" alt="" style="max-height:300px"></div>
<div style="position:absolute;left:64px;right:64px;top:835px"><div class="kicker" style="font-size:24px">Did you know?</div><div style="font-size:46px;font-weight:700;margin-top:12px;line-height:1.2">${esc(fact)}</div></div>
<div style="position:absolute;left:64px;right:64px;top:1112px;height:110px;border-radius:22px;background:#ffb02e;color:#12141c;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:800">More quizzes at countryfacts.app</div>`;
  return frame(body, { page: "2/2" });
}

// ---- map posts ----
// No label may be cut by the frame. Run in the page after the map is cropped. A label that crosses the edge (or comes within 10px of it) is
// moved inward only if the move is safe, otherwise hidden (with the capital dot beside a hidden city name):
//   - a country name may slide as far as needed, as long as it stays inside its own country's shape (Russia on Europe's first slide);
//   - any other label may move at most 40% of its own size;
//   - and a move that would touch another label is not made: the label is hidden instead.
const FIT_LABELS = `<script>
(function () {
  const panel = document.querySelector(".panel").getBoundingClientRect(), M = 10;
  const L = panel.left + M, R = panel.right - M, T = panel.top + M, B = panel.bottom - M;
  const svg = document.querySelector(".map-svg"), dots = [...svg.querySelectorAll(".capitals circle")], lands = [...svg.querySelectorAll("path.c")];
  const texts = [...svg.querySelectorAll("text")];
  const shown = (t) => { const r = t.getBoundingClientRect(); return r.width && r.height && t.style.display !== "none" ? r : null; };
  const visible = (r) => !(r.right < panel.left || r.left > panel.right || r.bottom < panel.top || r.top > panel.bottom);
  const touches = (a, b) => a.left < b.right + 3 && a.right > b.left - 3 && a.top < b.bottom + 3 && a.bottom > b.top - 3;
  const centre = (t) => { const b = t.getBBox(), m = t.transform.baseVal.numberOfItems ? t.transform.baseVal.consolidate().matrix : new DOMMatrix(); return new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform(m); };
  const landAt = (p) => lands.find((l) => l.isPointInFill(p));
  for (const t of texts) {
    const r = shown(t);
    if (!r || !visible(r)) continue;
    if (r.left >= L && r.right <= R && r.top >= T && r.bottom <= B) continue;
    let dx = 0, dy = 0;
    if (r.left < L) dx = L - r.left; else if (r.right > R) dx = R - r.right;
    if (r.top < T) dy = T - r.top; else if (r.bottom > B) dy = B - r.bottom;
    const k = t.parentNode.getScreenCTM().a, isCountry = /country/.test(t.getAttribute("class") || "");
    let placed = null;
    if (r.width <= R - L && r.height <= B - T) {
      const from = isCountry ? centre(t) : null, land = from ? landAt(from) : null;
      // A country name tries the inward move first, then the same move a line or two higher or lower; other labels only the plain move.
      for (const step of isCountry ? [0, -1, 1, -2, 2, -3, 3] : [0]) {
        const ddy = dy + step * r.height, moved = { left: r.left + dx, right: r.right + dx, top: r.top + ddy, bottom: r.bottom + ddy };
        if (moved.top < T || moved.bottom > B) continue;
        const inOwnLand = isCountry ? !!land && land.isPointInFill(new DOMPoint(from.x + dx / k, from.y + ddy / k)) : Math.abs(dx) <= r.width * 0.4 && Math.abs(dy) <= r.height * 0.4;
        if (inOwnLand && !texts.some((o) => o !== t && shown(o) && touches(moved, o.getBoundingClientRect()))) { placed = [dx, ddy]; break; }
      }
    }
    if (placed) {
      t.setAttribute("transform", "translate(" + placed[0] / k + " " + placed[1] / k + ") " + (t.getAttribute("transform") || ""));
    } else {
      t.style.display = "none";
      // The capital dot next to a hidden city name goes too; a hidden country name leaves its capital dots alone.
      if (!isCountry) for (const d of dots) { const c = d.getBoundingClientRect(); if (c.right > r.left - 16 && c.left < r.right + 16 && c.bottom > r.top - 16 && c.top < r.bottom + 16) d.style.display = "none"; }
    }
  }
  // A sea name with any letter lying under land is hidden too: it would read as a broken word.
  for (const t of svg.querySelectorAll("text.sea")) {
    if (!shown(t)) continue;
    const m = t.getScreenCTM();
    for (let i = 0; i < t.getNumberOfChars(); i++) {
      const e = t.getExtentOfChar(i);
      if (!e.width) continue;
      const p = new DOMPoint(e.x + e.width / 2, e.y + e.height / 2).matrixTransform(m);
      const top = document.elementFromPoint(p.x, p.y);
      if (top && top.matches("path.c")) { t.style.display = "none"; break; }
    }
  }
})();
</script>`;

// One slide of a map carousel: the map cropped to `view` (see sections.mjs) in a panel right under the title.
export function mapSlide(title, kicker, svg, ocean, view, counter) {
  const [, vw, vh] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  const twoLines = title.length > 18;
  let top = twoLines ? 345 : 295;
  const maxW = 1016, maxH = 1250 - top;
  let pw = maxW, ph = maxH, r;
  if (view.whole) {
    r = { x: 0, y: 0, w: vw, h: vh };
    const ratio = vw / vh;
    pw = Math.round(Math.min(maxW, maxH * ratio)); ph = Math.round(pw / ratio);
    if (ph < maxH * 0.7) top += Math.round((maxH - ph) / 2 - 20); // a wide world map sits in the middle of the space, not stuck under the title
  } else {
    const A = maxW / maxH;
    let w = view.w * vw, h = w / A;
    if (h > vh) { h = vh; w = h * A; }
    if (w > vw) { w = vw; h = w / A; }
    r = { x: Math.min(Math.max(view.cx * vw - w / 2, 0), vw - w), y: Math.min(Math.max(view.cy * vh - h / 2, 0), vh - h), w, h };
  }
  const cropped = svg.replace(/viewBox="0 0 [\d.]+ [\d.]+"/, `viewBox="${[r.x, r.y, r.w, r.h].map((n) => Math.round(n * 10) / 10).join(" ")}"`);
  const css = `${MAP_BASE}\n.panel{left:${Math.round((W - pw) / 2)}px;width:${pw}px;right:auto;top:${top}px;height:${ph}px;background:${ocean}}`;
  const body = `<div style="position:absolute;left:64px;right:64px;top:140px"><div class="kicker">${esc(kicker)}</div><h1 style="font-size:${twoLines ? 64 : 84}px;margin-top:10px;line-height:1.05">${esc(title)}</h1></div><div class="panel maps-page">${cropped}</div>`;
  return frame(body, { css, mapsCss: true, page: counter }) + FIT_LABELS;
}

// ---- Chrome ----
export function renderSlides(slides) {
  if (!CHROME) throw new Error("Google Chrome is needed to draw the images. Install it or set CHROME_PATH.");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ig-"));
  try {
    for (const { html, out } of slides) {
      const src = path.join(tmp, "slide.html");
      fs.writeFileSync(src, html);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${W},${H}`, "--virtual-time-budget=3000", `--user-data-dir=${path.join(tmp, "profile")}`, `--screenshot=${out}`, "file://" + src], { stdio: "ignore" });
      if (!fs.existsSync(out)) throw new Error(`Chrome did not draw ${out}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
