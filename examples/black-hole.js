// A supermassive black hole with a glowing accretion disc, ray-traced.
//
// For every pixel a ray of light is followed backwards from the camera through
// the curved spacetime of a non-spinning (Schwarzschild) black hole, using the
// orbit equation for light, with u = 1/r and mass M = 1:
//
//     d²u/dφ² = 3u² − u
//
// A ray that crosses the disc takes the disc's colour there: its temperature
// (Novikov–Thorne-like profile, hottest just outside r = 6M, the innermost stable
// orbit), shifted by gravitational redshift and by the Doppler effect of the
// disc's orbital motion. A ray that falls inside r = 2M is black. A ray that
// escapes shows the star it would reach, so the starfield is lensed too.
// The halo over the top and bottom is the far side of the disc, bent into view.
//
// Interstellar's Gargantua spins very fast; this one doesn't spin, and the film
// left out the Doppler brightening on purpose. Set doppler to 0 for the film look.

duration(Infinity);
view(1);

const tilt    = dial("tilt", 84, 60, 90, 0.5);      // camera angle from the disc's axis (90 = edge on)
const zoom    = dial("zoom", 15, 8, 40, 0.5);       // half-height of the picture, in units of M
const doppler = dial("doppler", 0.6, 0, 1, 0.05);   // 0 like the film · 1 the full physical effect
const spin    = dial("discSpeed", 1, 0, 4, 0.05);   // how fast the disc pattern turns (1 = real Kepler ratios)
const res     = dial("detail", 140, 60, 240, 10);   // rows of pixels
const dotPx   = dial("dotSize", 5, 1, 12, 0.5);     // pixel size on screen; match it to the detail
const warmth  = dial("warmth", 0.75, 0, 1, 0.05);   // 0 the true blackbody colour · 1 a film-style orange grade
const rIn = 6, rOut = 22;                           // disc from the innermost stable orbit outwards

const H = floor(res), W = floor(res * 1.7);
const s = sin((tilt * PI) / 180), c = cos((tilt * PI) / 180);
const nc = [0, -s, c];                              // unit vector from the hole to the camera
const e1 = [1, 0, 0], e2 = [0, c, s];               // screen right and up
const rCam = 80;

// ---- trace one ray: returns what it hit -----------------------------------
const trace = (bx, by) => {
  const B = [bx * e1[0] + by * e2[0], bx * e1[1] + by * e2[1], bx * e1[2] + by * e2[2]];
  const b = hypot(B[0], B[1], B[2]) || 1e-9;
  const Bh = [B[0] / b, B[1] / b, B[2] / b];
  let u = 1 / rCam;
  const w0 = 1 / (b * b) - u * u * (1 - 2 * u);
  if (w0 <= 0) return { kind: 0, dir: nc };
  let w = sqrt(w0);
  // the disc plane z = 0 is crossed where cos φ·nc_z + sin φ·Bh_z = 0
  let cross = atan2(-nc[2], Bh[2]);
  while (cross <= 0) cross += PI;
  let phi = 0;
  const dphi = 0.02;
  const acc = (u) => 3 * u * u - u;
  for (let k = 0; k < 900; k++) {
    // RK4 step of u'' = 3u² − u
    const k1u = w, k1w = acc(u);
    const k2u = w + (dphi / 2) * k1w, k2w = acc(u + (dphi / 2) * k1u);
    const k3u = w + (dphi / 2) * k2w, k3w = acc(u + (dphi / 2) * k2u);
    const k4u = w + dphi * k3w, k4w = acc(u + dphi * k3u);
    const un = u + (dphi / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
    const wn = w + (dphi / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    if (phi + dphi >= cross) {                       // crossing the disc plane in this step
      const f = (cross - phi) / dphi;
      const uc = u + (un - u) * f;
      const r = 1 / uc;
      if (uc > 0 && r >= rIn && r <= rOut) {
        const P = [r * (cos(cross) * nc[0] + sin(cross) * Bh[0]), r * (cos(cross) * nc[1] + sin(cross) * Bh[1])];
        return { kind: 2, r, psi: atan2(P[1], P[0]), bx };
      }
      cross += PI;
    }
    u = un;
    w = wn;
    phi += dphi;
    if (u >= 0.5) return { kind: 1 };                // inside the event horizon
    if (u <= 0) {                                    // escaped to infinity
      return { kind: 0, dir: [cos(phi) * nc[0] + sin(phi) * Bh[0], cos(phi) * nc[1] + sin(phi) * Bh[1], cos(phi) * nc[2] + sin(phi) * Bh[2]] };
    }
  }
  return { kind: 1 };                                // circled the photon sphere too long: treat as captured
};

// ---- the traced image is kept between frames and filled in a few rows at a time,
// so the worker never stalls; only the disc's rotation changes after that
const key = [H, W, tilt, zoom].join();
const cache = (globalThis.__blackHole ??= {});
if (cache.key !== key) Object.assign(cache, { key, rows: [], next: 0 });
const started = performance.now();
while (cache.next < H && performance.now() - started < 30) {
  const j = cache.next++;
  const row = [];
  const by = (1 - (2 * (j + 0.5)) / H) * zoom;
  for (let i = 0; i < W; i++) row.push(trace(((2 * (i + 0.5)) / W - 1) * zoom * (W / H), by));
  cache.rows[j] = row;
}

// ---- colour -------------------------------------------------------------
// blackbody colour of a temperature in kelvin (a standard fit to Planck's law)
const blackbody = (T) => {
  const t = T / 100;
  const r = t <= 66 ? 255 : 329.7 * (t - 60) ** -0.1332;
  const g = t <= 66 ? 99.47 * log(t) - 161.12 : 288.12 * (t - 60) ** -0.0755;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * log(t - 10) - 305.04;
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
};
const hash = (n) => { const x = sin(n * 12.9898 + 78.233) * 43758.5453; return x - floor(x); };
// emitted flux: ∝ r^−3 (1 − √(6/r)), zero at the inner edge and peaking just outside it
const flux = (r) => max(0, r ** -3 * (1 - sqrt(rIn / r)));
const peak = flux(rIn * 1.36);

const step = 1 / H;
pointSize(dotPx);
for (let j = 0; j < cache.rows.length; j++) {
  const row = cache.rows[j];
  if (!row) continue;
  const y = 1 - 2 * (j + 0.5) * step;
  for (let i = 0; i < row.length; i++) {
    const p = row[i];
    const x = (((2 * (i + 0.5)) / W - 1) * W) / H;
    if (p.kind === 2) {
      const omega = p.r ** -1.5;                                  // Kepler: Ω = r^−3/2
      const grav = sqrt(1 - 3 / p.r);                             // gravity + orbital time dilation
      const g = grav / (1 + doppler * omega * s * p.bx);          // observed / emitted frequency
      // turbulent streaks carried round at each radius's own speed
      const a = p.psi - spin * omega * t * 6;
      const texture = 0.55 + 0.25 * sin(9 * log(p.r) + 3 * a) * sin(23 * log(p.r) - 2 * a) + 0.2 * sin(41 * log(p.r) + a);
      const I = (flux(p.r) / peak) * g ** (3 + doppler) * texture;
      // temperature falls off as flux^(1/4); the observed colour is shifted by g
      const [R0, G0, B0] = blackbody(1500 + 3200 * clamp(g * (flux(p.r) / peak) ** 0.25, 0, 1.5));
      const R = R0, G = G0 * (1 - 0.3 * warmth), Bc = B0 * (1 - 0.65 * warmth);
      const shine = 1 - exp(-0.95 * I);
      color(R, G, Bc, clamp(shine, 0, 1));
      dot(x, y);
    } else if (p.kind === 0 && p.dir) {
      // the star this ray reaches: a fixed random sky, looked up by direction
      const lon = atan2(p.dir[1], p.dir[0]), lat = asin(clamp(p.dir[2], -1, 1));
      const cell = floor((lon + PI) * 400) * 4000 + floor((lat + PI / 2) * 400); // fine cells: one ray, one star
      if (hash(cell) > 0.9975) {
        color(255, 248, 235, 0.3 + 0.6 * hash(cell + 7));
        pointSize(max(1, dotPx * 0.35));
        dot(x, y);
        pointSize(dotPx);
      }
    }
  }
}
