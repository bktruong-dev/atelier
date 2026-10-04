// A supermassive black hole with a glowing accretion disc, drawn the way the
// first black-hole image was (Luminet, 1979): by tracing where each ring of the
// disc appears on screen. Every ring becomes a smooth curve, so the picture is
// continuous and stays sharp at any zoom — no pixels.
//
// Light: for each direction on the screen, rays are traced through the curved
// spacetime of a non-spinning (Schwarzschild) black hole, mass M = 1, using the
// orbit equation for light with u = 1/r:
//
//     d²u/dφ² = 3u² − u
//
// Each ray is followed until it crosses the disc plane (twice: the direct image,
// and the lensed image that forms the halo over the top and the thin ring
// around the shadow), falls through the horizon (r = 2), or escapes.
//
// Colour: the disc's temperature (Novikov–Thorne-like, hottest just outside the
// innermost stable orbit r = 6), shifted by gravitational redshift and by the
// Doppler effect of its orbit. Motion: every ring turns forever at its own
// Kepler speed Ω = r^(−3/2), so the inner disc laps the outer one.
//
// Interstellar's Gargantua spins fast and the film left the Doppler brightening
// out; set doppler to 0 and warmth near 1 for that look.

duration(Infinity);
view(1);

const tilt    = dial("tilt", 84, 60, 90, 0.5);     // camera angle from the disc's axis (90 = edge on)
const zoom    = dial("zoom", 17, 8, 40, 0.5);      // half-height of the picture, in units of M
const doppler = dial("doppler", 0.35, 0, 1, 0.05); // 0 the film's look · 1 the full physical effect
const warmth  = dial("warmth", 0.8, 0, 1, 0.05);   // 0 the true blackbody colour · 1 a film-style orange
const spin    = dial("discSpeed", 1, 0, 4, 0.05);  // how fast the disc turns; it never stops
const rings   = dial("rings", 160, 30, 240, 5);    // how many rings of the disc are drawn
const width   = dial("lineWidth", 2.8, 0.5, 6, 0.1);
const rIn = 6, rOut = 24;

const s = sin((tilt * PI) / 180), c = cos((tilt * PI) / 180);
const nc = [0, -s, c];                              // from the hole towards the camera
const e1 = [1, 0, 0], e2 = [0, c, s];               // screen right and up
const rCam = 60;

// ---- follow one ray (impact parameter b, screen angle α): its disc crossings
const trace = (b, alpha) => {
  const B = [cos(alpha) * e1[0] + sin(alpha) * e2[0], cos(alpha) * e1[1] + sin(alpha) * e2[1], cos(alpha) * e1[2] + sin(alpha) * e2[2]];
  let u = 1 / rCam;
  const w0 = 1 / (b * b) - u * u * (1 - 2 * u);
  if (w0 <= 0) return [];
  let w = sqrt(w0), phi = 0;
  let cross = atan2(-nc[2], B[2]);
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
    while (phi + d >= cross && hits.length < 2) {   // crossed the disc plane in this step
      const uc = u + ((un - u) * (cross - phi)) / d;
      if (uc > 0) {
        const r = 1 / uc;
        const px = r * (cos(cross) * nc[0] + sin(cross) * B[0]), py = r * (cos(cross) * nc[1] + sin(cross) * B[1]);
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

// ---- the traced geometry is kept between frames and built a few columns at a
// time (the worker never stalls). For each screen angle α we sample b and store
// where the direct (n = 0) and lensed (n = 1) images land on the disc.
const NA = 360, NB = 170;
const bMax = zoom * 1.9;
const bAt = (k) => 2.6 + (bMax - 2.6) * (k / (NB - 1)) ** 1.35;   // denser near the shadow
const key = [tilt, zoom, rings].join();
const cache = (globalThis.__blackHoleRings ??= {});
if (cache.key !== key) Object.assign(cache, { key, cols: [], next: 0, lines: null });
const t0 = performance.now();
while (cache.next < NA && performance.now() - t0 < 28) {
  const a = (TAU * cache.next) / NA;
  const col = [];
  for (let k = 0; k < NB; k++) col.push(trace(bAt(k), a));
  cache.cols[cache.next++] = col;
}

// ---- once traced: for each disc radius R, find the screen curve where it appears
if (cache.next >= NA && !cache.lines) {
  const radii = range(rings).map((i) => rIn + (rOut - rIn) * (i / (rings - 1)) ** 1.6);
  cache.lines = [];
  for (const n of [1, 0]) {                          // lensed image first, so the direct one sits on top
    for (const R of radii) {
      const pts = [];
      for (let j = 0; j <= NA; j++) {
        const jj = j % NA, a = (TAU * jj) / NA, col = cache.cols[jj];
        let found = null;
        for (let k = 0; k < NB - 1 && !found; k++) {
          const h0 = col[k][n], h1 = col[k + 1][n];
          if (!h0 || !h1 || !isFinite(h0.r) || !isFinite(h1.r)) continue;
          if ((h0.r - R) * (h1.r - R) <= 0 && h0.r !== h1.r) {
            const f = (R - h0.r) / (h1.r - h0.r);
            const b = bAt(k) + (bAt(k + 1) - bAt(k)) * f;
            let dpsi = h1.psi - h0.psi;
            if (dpsi > PI) dpsi -= TAU;
            if (dpsi < -PI) dpsi += TAU;
            found = { x: (b * cos(a)) / zoom, y: (b * sin(a)) / zoom, psi: h0.psi + dpsi * f, bx: b * cos(a) };
          }
        }
        pts.push(found);                             // null where this ring isn't visible
      }
      cache.lines.push({ R, n, pts });
    }
  }
}

// ---- colour ---------------------------------------------------------------
const blackbody = (T) => {                           // a standard fit to Planck's law
  const t = T / 100;
  const r = t <= 66 ? 255 : 329.7 * (t - 60) ** -0.1332;
  const g = t <= 66 ? 99.47 * log(t) - 161.12 : 288.12 * (t - 60) ** -0.0755;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * log(t - 10) - 305.04;
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
};
const flux = (r) => max(0, r ** -3 * (1 - sqrt(rIn / r)));   // ∝ r^−3 (1 − √(6/r))
const peak = flux(rIn * 1.36);

if (!cache.lines) {
  // still tracing: show progress as a thin arc
  color(255, 200, 140, 0.6);
  strokeWidth(1.5);
  path(range(61).map((k) => [0.25 * cos((TAU * k * cache.next) / NA / 60), 0.25 * sin((TAU * k * cache.next) / NA / 60)]));
} else {
  strokeWidth(width);
  for (const { R, n, pts } of cache.lines) {
    const omega = R ** -1.5;                         // Kepler
    const grav = sqrt(1 - 3 / R);                    // gravity + orbital time dilation
    const base = flux(R) / peak;
    const dim = n === 1 ? 0.75 : 1;                  // the lensed image is a little fainter
    let run = [];
    let runColor = null;
    const flush = () => {
      if (run.length > 1) { color(...runColor); path(run); }
      run = [];
    };
    for (let j = 0; j < pts.length; j++) {
      const p = pts[j];
      if (!p) { flush(); continue; }
      // colour this stretch of the ring (every 4 steps)
      if (j % 4 === 0 || !runColor) {
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
  }
}

// a scattering of distant stars (none inside the shadow, where light can't come from)
const hash = (k) => { const x = sin(k * 12.9898 + 78.233) * 43758.5453; return x - floor(x); };
for (let i = 0; i < 260; i++) {
  const x = (hash(i) * 2 - 1) * 1.9, y = hash(i + 0.5) * 2 - 1;
  if (hypot(x, y) * zoom < 6) continue;
  color(255, 246, 232, 0.25 + 0.5 * hash(i + 0.25));
  pointSize(1 + 1.5 * hash(i + 0.75));
  dot(x, y);
}
