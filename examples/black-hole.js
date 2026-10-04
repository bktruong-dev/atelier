// A supermassive black hole with a glowing accretion disc, seen from any angle.
//
// Drawn the way the first black-hole image was (Luminet, 1979): light is traced
// through the curved spacetime of a non-spinning (Schwarzschild) black hole,
// mass M = 1, with the orbit equation for light (u = 1/r):
//
//     d²u/dφ² = 3u² − u
//
// and every ring of the disc becomes a smooth curve where it appears on screen:
// the direct image, the lensed image (the halo over the top and the thin ring
// around the shadow). Bent light depends on where you look from, so each
// viewing angle is traced for real; angles are kept once traced, so the fly-by
// around the hole plays smoothly after its first pass.
//
// Colour: temperature (hottest just outside the innermost stable orbit r = 6),
// gravitational redshift and the Doppler shift of the disc's orbit. Motion:
// each ring turns forever at its Kepler speed Ω = r^(−3/2).
//
// Interstellar's Gargantua spins fast and the film left Doppler brightening out:
// doppler 0 and warmth near 1 give that look.

duration(Infinity);
view(1);

const tilt    = dial("tilt", 84, 3, 177, 1);       // viewing angle from the disc's axis: 90 edge on, under 90 above, over 90 below
const flyby   = dial("flyby", 22, 0, 80, 1);       // the camera swings this many degrees above and below `tilt`
const flyTime = dial("flyPeriod", 40, 10, 120, 1); // seconds for one swing
const zoom    = dial("zoom", 17, 8, 40, 0.5);      // half-height of the picture, in units of M
const doppler = dial("doppler", 0.35, 0, 1, 0.05); // 0 the film's look · 1 the full physical effect
const warmth  = dial("warmth", 0.8, 0, 1, 0.05);   // 0 the true blackbody colour · 1 a film-style orange
const spin    = dial("discSpeed", 1, 0, 4, 0.05);  // how fast the disc turns; it never stops
const rings   = dial("rings", 150, 30, 240, 5);    // how many rings of the disc are drawn
const width   = dial("lineWidth", 2.8, 0.5, 6, 0.1);
const rIn = 6, rOut = 24, rCam = 60;
const NA = 240, NB = 130;                          // screen angles × impact parameters traced per view
const bMax = zoom * 1.9;
const bAt = (k) => 2.6 + (bMax - 2.6) * (k / (NB - 1)) ** 1.35;   // denser near the shadow

// the angle we're looking from right now, to the nearest degree
const want = round(clamp(tilt + flyby * sin((TAU * t) / flyTime), 3, 177));

// ---- trace one ray from a camera at inclination `deg`: its disc crossings ----
const camera = (deg) => {
  const s = sin((deg * PI) / 180), c = cos((deg * PI) / 180);
  return { s, nc: [0, -s, c], e2: [0, c, s] };      // towards the camera; screen up (screen right is x)
};
const trace = (cam, b, alpha) => {
  const B = [cos(alpha), sin(alpha) * cam.e2[1], sin(alpha) * cam.e2[2]];
  let u = 1 / rCam;
  const w0 = 1 / (b * b) - u * u * (1 - 2 * u);
  if (w0 <= 0) return [];
  let w = sqrt(w0), phi = 0;
  let cross = atan2(-cam.nc[2], B[2]);              // the disc plane z = 0 is crossed here, then every π
  while (cross <= 0) cross += PI;
  const hits = [];
  const acc = (x) => 3 * x * x - x;
  for (let k = 0; k < 700 && hits.length < 2; k++) {
    const d = u < 0.06 ? 0.05 : 0.02;               // bigger steps far from the hole
    const k1u = w, k1w = acc(u);
    const k2u = w + (d / 2) * k1w, k2w = acc(u + (d / 2) * k1u);
    const k3u = w + (d / 2) * k2w, k3w = acc(u + (d / 2) * k2u);
    const k4u = w + d * k3w, k4w = acc(u + d * k3u);
    const un = u + (d / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
    const wn = w + (d / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    while (phi + d >= cross && hits.length < 2) {
      const uc = u + ((un - u) * (cross - phi)) / d;
      if (uc > 0) {
        const r = 1 / uc;
        const px = r * (cos(cross) * cam.nc[0] + sin(cross) * B[0]);
        const py = r * (cos(cross) * cam.nc[1] + sin(cross) * B[1]);
        hits.push({ r, psi: atan2(py, px) });
      } else hits.push({ r: Infinity, psi: 0 });
      cross += PI;
    }
    u = un;
    w = wn;
    phi += d;
    if (u >= 0.5 || u <= 0) break;                   // fell in, or escaped
  }
  return hits;
};

// for each disc radius R, the screen curve where it appears (lensed image first)
const buildLines = (cols) => {
  const radii = range(rings).map((i) => rIn + (rOut - rIn) * (i / (rings - 1)) ** 1.6);
  const lines = [];
  for (const n of [1, 0]) {
    for (const R of radii) {
      const pts = [];
      for (let j = 0; j <= NA; j++) {
        const jj = j % NA, a = (TAU * jj) / NA, col = cols[jj];
        let found = null;
        for (let k = 0; k < NB - 1 && !found; k++) {
          const h0 = col[k][n], h1 = col[k + 1][n];
          if (!h0 || !h1 || !isFinite(h0.r) || !isFinite(h1.r) || h0.r === h1.r) continue;
          if ((h0.r - R) * (h1.r - R) <= 0) {
            const f = (R - h0.r) / (h1.r - h0.r);
            const b = bAt(k) + (bAt(k + 1) - bAt(k)) * f;
            let dpsi = h1.psi - h0.psi;
            if (dpsi > PI) dpsi -= TAU;
            if (dpsi < -PI) dpsi += TAU;
            found = { x: (b * cos(a)) / zoom, y: (b * sin(a)) / zoom, psi: h0.psi + dpsi * f, bx: b * cos(a) };
          }
        }
        pts.push(found);
      }
      lines.push({ R, n, pts });
    }
  }
  return lines;
};

// ---- views are kept between frames, one per degree, traced a little each frame
const store = (globalThis.__blackHoleViews ??= { key: "", views: new Map() });
const key = [zoom, rings].join();
if (store.key !== key) { store.key = key; store.views = new Map(); }
let todo = store.views.get(want);
if (!todo) { todo = { cam: camera(want), cols: [], next: 0, lines: null }; store.views.set(want, todo); }
const t0 = performance.now();
while (!todo.lines && performance.now() - t0 < 26) {
  if (todo.next < NA) {
    const a = (TAU * todo.next) / NA, col = [];
    for (let k = 0; k < NB; k++) col.push(trace(todo.cam, bAt(k), a));
    todo.cols[todo.next++] = col;
  } else {
    todo.lines = buildLines(todo.cols);
    todo.cols = null;                                // keep only the finished curves
  }
}
// show the wanted view if ready, otherwise the nearest one that is
let shown = null, shownDeg = want;
for (let d = 0; d <= 180 && !shown; d++) {
  for (const deg of [want - d, want + d]) {
    const v = store.views.get(deg);
    if (v && v.lines) { shown = v; shownDeg = deg; break; }
  }
}

// ---- colour ----------------------------------------------------------------
const blackbody = (T) => {                           // a standard fit to Planck's law
  const t100 = T / 100;
  const r = t100 <= 66 ? 255 : 329.7 * (t100 - 60) ** -0.1332;
  const g = t100 <= 66 ? 99.47 * log(t100) - 161.12 : 288.12 * (t100 - 60) ** -0.0755;
  const b = t100 >= 66 ? 255 : t100 <= 19 ? 0 : 138.52 * log(t100 - 10) - 305.04;
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
};
const flux = (r) => max(0, r ** -3 * (1 - sqrt(rIn / r)));   // ∝ r^−3 (1 − √(6/r))
const peak = flux(rIn * 1.36);

if (!shown) {
  // the very first view is still being traced: a thin progress arc
  color(255, 200, 140, 0.6);
  strokeWidth(1.5);
  path(range(61).map((k) => [0.25 * cos((TAU * k * todo.next) / NA / 60), 0.25 * sin((TAU * k * todo.next) / NA / 60)]));
} else {
  const s = sin((shownDeg * PI) / 180);
  strokeWidth(width);
  shown.lines.forEach(({ R, n, pts }, ring) => {
    const omega = R ** -1.5;                         // Kepler
    const grav = sqrt(1 - 3 / R);                    // gravity + orbital time dilation
    const base = flux(R) / peak;
    const dim = n === 1 ? 0.75 : 1;                  // the lensed image is a little fainter
    let run = [], runColor = null;
    const flush = () => {
      if (run.length > 1) { color(...runColor); path(run); }
      run = [];
    };
    for (let j = 0; j < pts.length; j++) {
      const p = pts[j];
      if (!p) { flush(); continue; }
      // colour changes every 4 steps, staggered ring by ring so the joins don't line up into spokes
      if ((j + ring) % 4 === 0 || !runColor) {
        const g = grav / (1 + doppler * omega * s * p.bx);
        const a = p.psi - spin * omega * t * 40;      // the disc's pattern, turning at Ω(R)
        const lr = log(R);
        const texture = 0.5 + 0.22 * sin(9 * lr + 3 * a) * sin(23 * lr - 2 * a) + 0.16 * sin(41 * lr + 5 * a) + 0.12 * sin(17 * lr - 7 * a);
        const I = base * g ** (3 + doppler) * texture * dim;
        const [R0, G0, B0] = blackbody(1500 + 3200 * clamp(g * base ** 0.25, 0, 1.5));
        const next = [R0, G0 * (1 - 0.3 * warmth), B0 * (1 - 0.65 * warmth), clamp(1 - exp(-1.3 * I), 0, 1)];
        if (run.length) { run.push([p.x, p.y]); flush(); }
        runColor = next;
      }
      run.push([p.x, p.y]);
    }
    flush();
  });
}

// a scattering of distant stars (none inside the shadow, where no light comes from)
const hash = (k) => { const x = sin(k * 12.9898 + 78.233) * 43758.5453; return x - floor(x); };
for (let i = 0; i < 260; i++) {
  const x = (hash(i) * 2 - 1) * 1.9, y = hash(i + 0.5) * 2 - 1;
  if (hypot(x, y) * zoom < 6) continue;
  color(255, 246, 232, 0.25 + 0.5 * hash(i + 0.25));
  pointSize(1 + 1.5 * hash(i + 0.75));
  dot(x, y);
}
