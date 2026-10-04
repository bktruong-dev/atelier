// Two black holes (or two neutron stars) spiralling together and merging.
//
// Inspiral: the orbit shrinks as gravitational waves carry energy away. For a
// circular orbit in the quadrupole approximation (Peters, 1964) the separation
// goes as  a ∝ τ^(1/4)  and the orbital phase as  Φ = Φc − (8/5)·ω0·τ0·(τ/τ0)^(5/8),
// with τ the time left before merger; the orbit's speed obeys Kepler, ω ∝ a^(−3/2).
//
// The waves: on the orbital plane the strain has the quadrupole pattern
//   h ∝ ω^(2/3) cos 2(θ − Φ(t − r/c)) / r,
// a two-armed spiral moving outward at the speed of light. Here it lifts and
// lowers a sheet of points (the "spacetime sheet" in the usual pictures).
// After merger the remnant rings down: a damped wave at the remnant's own pitch.
//
// kind = 1 swaps in two neutron stars: the merger flings out a kilonova, the
// explosion that forges gold. Fast, lanthanide-poor ejecta near the poles glow
// blue; slower, lanthanide-rich ejecta near the equator glow red, and redden as
// they cool; a jet fires along the axis. Ejecta coast outward, r = v·t.
//
// Distances and times are scaled to fit the screen; the shapes and the laws
// (exponents, chirp, retarded time, ringdown) are the physical ones.

orbit(20, 55);
duration(22);
view(10);

const kind   = dial("kind", 0, 0, 1, 1);          // 0 black holes · 1 neutron stars → kilonova
const orbits = dial("orbits", 9, 3, 20, 1);       // orbits before merger
const lift   = dial("waveHeight", 1.6, 0, 4, 0.1); // how far the waves lift the sheet
const c      = dial("lightSpeed", 3.2, 1, 8, 0.1); // wave speed across the screen
const rings  = dial("sheetRings", 42, 16, 80, 1);

const tc = 12;                       // merger time
const a0 = 3.2;                      // starting separation
const tau0 = tc;                     // the inspiral starts at t = 0
const w0 = (orbits * TAU * 5) / 8 / tau0;   // so the inspiral makes `orbits` turns
const aMerge = 0.55;                 // separation at which they touch
const tauMerge = tau0 * (aMerge / a0) ** 4;

// the binary at (retarded) time s: separation, angular speed, phase
const binary = (s) => {
  const tau = max(tc - s, tauMerge);
  const a = a0 * (tau / tau0) ** 0.25;                       // a ∝ τ^(1/4)
  const w = w0 * (a0 / a) ** 1.5;                            // Kepler: ω ∝ a^(−3/2)
  const phi = -(8 / 5) * w0 * tau0 * (tau / tau0) ** 0.625;  // Φ ∝ −τ^(5/8)
  return { a, w, phi };
};
const atMerge = binary(tc);
const wRing = atMerge.w * 1.4;        // ringdown pitch, a little above the last orbit
const tauRing = 0.9;                  // ringdown e-folding time

// strain at radius r and angle θ on the orbital plane, using the retarded time
const strain = (r, th) => {
  const s = t - r / c;
  if (s < 0) return 0;
  if (s < tc) {
    const b = binary(s);
    return ((b.w / w0) ** (2 / 3) * cos(2 * (th - b.phi))) / sqrt(r);  // 1/r softened to 1/√r so it stays visible
  }
  const dt = s - tc;
  const amp = (atMerge.w / w0) ** (2 / 3) * exp(-dt / tauRing);
  return (amp * cos(2 * (th - atMerge.phi - wRing * dt))) / sqrt(r);
};

// ---- the spacetime sheet, coloured by strain (blue down, gold up) ----------
const bins = range(9).map(() => []);
for (let i = 1; i <= rings; i++) {
  const r = 0.9 + (9.2 * i) / rings;
  const spokes = floor(24 + 3 * i);
  for (let k = 0; k < spokes; k++) {
    const th = (TAU * k) / spokes;
    const hh = strain(r, th);
    const b = clamp(round(4 + hh * 4), 0, 8);
    bins[b].push([r * cos(th), lift * hh, r * sin(th)]);
  }
}
// after a neutron-star merger the sheet fades so the explosion stands out
const sheet = kind && t > tc ? 0.25 + 0.75 * exp(-(t - tc) / 1.5) : 1;
pointSize(2.2);
bins.forEach((pts, b) => {
  const v = (b - 4) / 4;                                         // −1 … 1
  color(v < 0 ? hsl(215, 80, 55 + 20 * -v, sheet * (0.35 + 0.5 * -v)) : hsl(40, 90, 55 + 20 * v, sheet * (0.35 + 0.5 * v)));
  for (const p of pts) dot(...p);
});

// ---- the two bodies, then the remnant ------------------------------------
const now = binary(min(t, tc));
const glowBody = (x, z, size, hex) => {
  color(hex);
  pointSize(size);
  dot(x, 0, z);
};
if (t < tc) {
  const half = now.a / 2;
  const [x1, z1] = [half * cos(now.phi), half * sin(now.phi)];
  // a short trail of each body's recent path
  strokeWidth(1.2);
  for (const sign of [1, -1]) {
    const trail = range(40).map((k) => {
      const b = binary(min(t, tc) - k * 0.03);
      return [(sign * b.a) / 2 * cos(b.phi), 0, (sign * b.a) / 2 * sin(b.phi)];
    });
    color(kind ? hsl(190, 90, 75, 0.6) : hsl(30, 90, 70, 0.6));
    path(trail);
  }
  if (kind) {
    glowBody(x1, z1, 9, "#bfeaff");
    glowBody(-x1, -z1, 9, "#bfeaff");
  } else {
    // black holes: dark centres in a bright lensing ring
    for (const sign of [1, -1]) {
      color(255, 214, 150, 0.9);
      path(range(33).map((k) => [sign * x1 + 0.32 * cos((TAU * k) / 32), 0.32 * sin((TAU * k) / 32), sign * z1]), true);
      glowBody(sign * x1, sign * z1, 9, "#000000");
    }
  }
} else if (!kind) {
  // the remnant black hole, ringing down
  const ring = 0.45 * (1 + 0.15 * exp(-(t - tc) / tauRing) * cos(2 * wRing * (t - tc)));
  color(255, 214, 150, 0.95);
  strokeWidth(1.6);
  path(range(49).map((k) => [ring * cos((TAU * k) / 48), ring * sin((TAU * k) / 48), 0]), true);
  glowBody(0, 0, 12, "#000000");
}

// ---- neutron stars: the kilonova -------------------------------------------
if (kind && t >= tc) {
  const age = t - tc;
  const hash = (n) => { const x = sin(n * 12.9898 + 78.233) * 43758.5453; return x - floor(x); };
  // a flash at the moment of merger
  const flash = exp(-age * 3);
  color(hsl(50, 100, 90, flash));
  pointSize(10 + 90 * flash);
  dot(0, 0, 0);
  // ejecta: each particle coasts outward at its own speed, r = v·age
  for (let i = 0; i < 1400; i++) {
    const u = 2 * hash(i * 1.7) - 1;                             // cos of the polar angle
    const ph = TAU * hash(i * 3.3);
    const polar = abs(u);                                        // 1 at the poles, 0 at the equator
    const v = (0.6 + 0.9 * polar) * (0.7 + 0.5 * hash(i * 5.1)); // poles faster
    const wobble = 1 + 0.12 * sin(7 * ph + 5 * u) * sin(9 * u);  // Rayleigh–Taylor-like fingers
    const r = v * age * 1.6 * wobble;
    const sinT = sqrt(1 - u * u);
    const p = [r * sinT * cos(ph), r * u, r * sinT * sin(ph)];
    // blue (fast, polar) → red (slow, equatorial), everything reddening as it cools
    const cool = clamp(age / 8, 0, 1);
    // (blue fades through violet to red; it never passes through green)
    const hue = polar > 0.5 ? lerp(212, 352, cool) : lerp(22, 2, cool);
    const fade = exp(-age / 9);
    color(hsl(hue, 95, 64, 0.3 + 0.7 * fade));
    pointSize(3.2);
    dot(...p);
  }
  // the relativistic jet along the axis, brief
  const jet = exp(-age / 1.2);
  if (jet > 0.02) {
    strokeWidth(2.5);
    color(hsl(200, 100, 85, jet));
    line([0, 0, 0], [0, 9 * min(1, age * 2), 0]);
    line([0, 0, 0], [0, -9 * min(1, age * 2), 0]);
  }
}
