// Local static server for development: like `python3 -m http.server`, but every
// response says "do not cache", so the browser never shows an old app.js, map or
// data file. (python's server sends only Last-Modified, which lets browsers
// reuse files without asking, even through a normal refresh.)
//
//   node scripts/serve.mjs [port]      # default port 8000
//
// Development only: GitHub Pages serves the site and sets its own caching.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.argv[2]) || 8000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    const headers = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" };
    let rel;
    try {
      rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400, headers).end("Bad request");
      return;
    }
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
      res.writeHead(403, headers).end("Forbidden");
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { ...headers, "Content-Type": "text/plain" }).end("Not found");
        return;
      }
      res.writeHead(200, { ...headers, "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(req.method === "HEAD" ? undefined : data);
    });
  })
  .listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT} (no caching)`));
