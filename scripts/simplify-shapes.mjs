// Coarser copies of a map's land shapes (a Map of code -> [{ rings: [[x, y], ...] }], in SVG units) for the phone viewer's zoomed-out view.
//
// Douglas-Peucker, but never on a ring on its own: every ring is cut into chains at the points where the set of rings that share its edges
// changes (a border with a neighbour starts or ends, or the coast begins). A chain shared by two countries is the same list of points in both,
// so it is simplified once, in a canonical direction, and both countries get the identical result: the border stays a single line, with no gap
// or overlap between neighbours. (This is what simplify-topology.mjs does for a TopoJSON, whose arcs are exactly these chains; the shapes here
// are already projected and cut, so the chains are found from the points instead.) Coasts and rings that touch nothing are simplified on their own.
// Points are matched to 0.01 of a unit.

const key = (p) => p[0].toFixed(2) + "," + p[1].toFixed(2);

// Douglas-Peucker on one chain (the first and last points are always kept); returns the indices to keep.
function dp(pts, tol) {
  const n = pts.length, keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const [ax, ay] = pts[a], dx = pts[b][0] - ax, dy = pts[b][1] - ay, len2 = dx * dx + dy * dy;
    let far = -1, farD = tol;
    for (let i = a + 1; i < b; i++) {
      let d;
      if (len2 === 0) d = Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
      else {
        const u = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len2));
        d = Math.hypot(pts[i][0] - (ax + u * dx), pts[i][1] - (ay + u * dy));
      }
      if (d > farD) { farD = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return keep;
}

export function simplifyShapes(shapes, tol) {
  const rings = []; // { pts, keys, owner }
  for (const [a3, polys] of shapes) for (const poly of polys) for (const pts of poly.rings) rings.push({ a3, pts, keys: pts.map(key) });
  // who owns each edge (a ring owns the edge between two neighbouring points)
  const owners = new Map();
  const edgeKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  rings.forEach((r, id) => {
    r.sig = [];
    const n = r.pts.length;
    for (let i = 0; i < n; i++) {
      const k = edgeKey(r.keys[i], r.keys[(i + 1) % n]);
      let s = owners.get(k);
      if (!s) owners.set(k, (s = new Set()));
      s.add(id);
      r.sig.push(k);
    }
  });
  const sigOf = (k) => [...owners.get(k)].sort((a, b) => a - b).join(",");
  const cache = new Map(); // canonical chain -> kept points
  let before = 0, after = 0;
  const out = new Map();
  rings.forEach((r) => {
    const n = r.pts.length;
    before += n;
    if (n < 4) { after += n; push(r, r.pts); return; }
    const sg = r.sig.map(sigOf); // sg[i] describes the edge i -> i+1
    let nodes = [];
    for (let i = 0; i < n; i++) if (sg[(i + n - 1) % n] !== sg[i]) nodes.push(i);
    if (nodes.length === 0) { // a ring on its own: anchor it at its first point and the one farthest from it
      let far = 0, fd = -1;
      for (let i = 1; i < n; i++) { const d = Math.hypot(r.pts[i][0] - r.pts[0][0], r.pts[i][1] - r.pts[0][1]); if (d > fd) { fd = d; far = i; } }
      nodes = [0, far];
    } else if (nodes.length === 1) nodes.push((nodes[0] + Math.floor(n / 2)) % n);
    const kept = [];
    for (let c = 0; c < nodes.length; c++) {
      const a = nodes[c], b = nodes[(c + 1) % nodes.length];
      const chain = [];
      for (let i = a; ; i = (i + 1) % n) { chain.push(i); if (i === b && chain.length > 1) break; }
      const pts = chain.map((i) => r.pts[i]), ks = chain.map((i) => r.keys[i]);
      const fwd = ks[0] < ks[ks.length - 1] || (ks[0] === ks[ks.length - 1] && ks.length > 1 && ks[1] <= ks[ks.length - 2]);
      const cp = fwd ? pts : pts.slice().reverse(), ck = (fwd ? ks : ks.slice().reverse()).join(";");
      let res = cache.get(ck);
      if (!res) { const keep = dp(cp, tol); res = cp.filter((_, i) => keep[i]); cache.set(ck, res); }
      const oriented = fwd ? res : res.slice().reverse();
      for (let i = 0; i < oriented.length - 1; i++) kept.push(oriented[i]); // the last point starts the next chain
    }
    const ring = kept.length >= 3 ? kept : r.pts; // a speck that would collapse keeps its points
    after += ring.length;
    push(r, ring);
  });
  function push(r, ring) {
    if (!out.has(r.a3)) out.set(r.a3, new Map());
    out.get(r.a3).set(r.pts, ring);
  }
  // the same structure as `shapes`, with each ring replaced
  const result = new Map();
  for (const [a3, polys] of shapes) result.set(a3, polys.map((poly) => ({ ...poly, rings: poly.rings.map((pts) => out.get(a3).get(pts)) })));
  return { shapes: result, before, after };
}
