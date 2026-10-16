// Visvalingam–Whyatt simplification for a quantized TopoJSON topology.
// Arcs are simplified independently and shared borders are a single arc, so
// neighbouring countries stay glued together (no gaps or overlaps).
// Dependency-free so scripts/update-data.mjs needs nothing from npm.

// Effective area of every point of one arc (absolute coords): the area of the
// triangle it forms with its neighbours at the moment it would be removed,
// never smaller than any earlier removal. Endpoints are Infinity.
function effectiveAreas(pts) {
  const n = pts.length;
  const area = new Float64Array(n).fill(Infinity);
  if (n < 3) return area;
  const prev = new Int32Array(n);
  const next = new Int32Array(n);
  const tri = (a, b, c) =>
    Math.abs((pts[a][0] - pts[c][0]) * (pts[b][1] - pts[a][1]) - (pts[a][0] - pts[b][0]) * (pts[c][1] - pts[a][1])) / 2;
  for (let i = 0; i < n; i++) {
    prev[i] = i - 1;
    next[i] = i + 1;
  }
  // Binary min-heap of [area, index]; stale entries are skipped on pop.
  const heap = [];
  const cur = new Float64Array(n).fill(Infinity);
  const push = (a, i) => {
    heap.push([a, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  for (let i = 1; i < n - 1; i++) {
    cur[i] = tri(i - 1, i, i + 1);
    push(cur[i], i);
  }
  let maxSoFar = 0;
  while (heap.length) {
    const [a, i] = pop();
    if (a !== cur[i] || area[i] !== Infinity) continue;
    maxSoFar = Math.max(maxSoFar, a);
    area[i] = maxSoFar;
    const p = prev[i];
    const q = next[i];
    next[p] = q;
    prev[q] = p;
    if (p > 0) {
      cur[p] = tri(prev[p], p, q);
      push(cur[p], p);
    }
    if (q < n - 1) {
      cur[q] = tri(p, q, next[q]);
      push(cur[q], q);
    }
  }
  return area;
}

// Keeps roughly `keepFraction` of all arc points, using one global area
// threshold so detail is dropped where the coastline is least informative.
export function simplifyTopology(topology, keepFraction) {
  const decoded = topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => [(x += dx), (y += dy)]);
  });
  const areas = decoded.map(effectiveAreas);

  const finite = [];
  let total = 0;
  for (const a of areas) {
    total += a.length;
    for (let i = 1; i < a.length - 1; i++) finite.push(a[i]);
  }
  finite.sort((a, b) => a - b);
  const keepInterior = Math.max(0, Math.round(total * keepFraction) - 2 * areas.length);
  const threshold = finite[Math.max(0, finite.length - keepInterior)] ?? 0;

  let kept = 0;
  topology.arcs = decoded.map((pts, ai) => {
    const a = areas[ai];
    let idx = [];
    for (let i = 0; i < pts.length; i++) if (i === 0 || i === pts.length - 1 || a[i] >= threshold) idx.push(i);
    // A closed ring needs at least 4 points to stay a valid polygon.
    const closed = pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
    if (closed && idx.length < 4 && pts.length >= 4) {
      const interior = [...Array(pts.length - 2).keys()].map((i) => i + 1).sort((p, q) => a[q] - a[p]);
      idx = [0, ...interior.slice(0, 2).sort((p, q) => p - q), pts.length - 1];
    }
    kept += idx.length;
    let px = 0;
    let py = 0;
    return idx.map((i) => {
      const out = [pts[i][0] - px, pts[i][1] - py];
      [px, py] = pts[i];
      return out;
    });
  });
  return { before: total, after: kept };
}
