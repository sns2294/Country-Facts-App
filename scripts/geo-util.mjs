// Geometry helpers shared by the map builders (scripts/build-maps.mjs, scripts/build-density-map.mjs).

export const clipHalf = (ring, axis, value, keepGreater) => { // Sutherland-Hodgman against one meridian or parallel, in degrees
  const inside = (p) => (keepGreater ? p[axis] >= value : p[axis] <= value);
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push(axis === 0 ? [value, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), value]);
    }
  }
  return out;
};

export const key = (c) => `${c[0]},${c[1]}`;
// Join two open rings that share one contiguous run of identical vertices (the arcs their countries share) into one
// outline, so no seam shows. Returns null if they do not share exactly one run.
export const stitch = (a, b) => {
  const inB = new Set(b.map(key)), inA = new Set(a.map(key));
  const shared = a.map((c) => inB.has(key(c)));
  const n = a.length, count = shared.filter(Boolean).length;
  if (!count || count === n) return null;
  let start = -1; // first shared vertex after a non-shared one
  for (let i = 0; i < n; i++) if (shared[i] && !shared[(i + n - 1) % n]) { if (start >= 0) return null; start = i; }
  if (start < 0) return null;
  const run = []; // a's shared run, in a's order
  for (let k = 0; k < count; k++) { if (!shared[(start + k) % n]) return null; run.push(a[(start + k) % n]); }
  const s0 = key(run[0]), s1 = key(run.at(-1));
  const aRest = []; // from just after the run, round to just before it
  for (let k = count; k < n; k++) aRest.push(a[(start + k) % n]);
  const m = b.length, bi = (id) => b.findIndex((c) => key(c) === id);
  const i1 = bi(s1), i0 = bi(s0);
  for (const dir of [1, -1]) { // b's outer part, from the run's far end round to its near end
    const path = [];
    let i = i1, ok = true;
    for (let guard = 0; guard < m; guard++) {
      i = (i + dir + m) % m;
      if (i === i0) break;
      if (inA.has(key(b[i]))) { ok = false; break; }
      path.push(b[i]);
      if (guard === m - 1) ok = false;
    }
    if (ok && path.length) return [run.at(-1), ...aRest, run[0], ...path.reverse()]; // the shared run becomes interior
  }
  return null;
};
