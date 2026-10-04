// Navier–Stokes blow-up, after OpenAI's "Finite time blowup for Navier–Stokes"
// (2026). A simulation of tracer particles carried by the vortex core that the
// paper describes, using its exact scalings:
//
//   singularity at the origin at t = 1, with τ = 1 − t the time remaining
//   core radius  ℓr ≍ τ^(1/2)          core height  ℓz ≍ τ^(1/2 − h),  0 < h < 1/100
//   swirl, axial speed ≍ τ^−(1/2 + h)   radial speed = O(τ^−1/2)
//
// Inside the core fluid spirals inward and flows up and down on opposite sides
// of a dividing layer near z = 0 (with a slight upward bias); farther above and
// below there is radial outflow. The velocity field here is exactly
// incompressible (built from a stream function) and has that shape, but it is a
// model: the paper's own core profile is a numerically constructed function.
//
// The particles are integrated in the paper's time variable s = −ln τ, in
// similarity coordinates ρ = r/ℓr, ζ = z/ℓz, where the flow is nearly steady.
// Colour is the true speed: blue slow → yellow fast. The faint rings at the
// core's edge stand in for the paper's oscillatory "pulses" (illustrative).

orbit(25, 14);
duration(24);
view(3.4);

const h       = dial("h", 0.01, 0.005, 0.3, 0.005);   // anisotropy; the paper has h < 1/100 (try 0.2 to exaggerate)
const inflow  = dial("inflow", 2.2, 0.5, 4, 0.1);     // strength of the meridional (in-and-out) flow
const swirl   = dial("swirl", 3, 0.5, 8, 0.1);        // strength of the rotation
const bias    = dial("bias", 0.15, 0, 0.6, 0.01);     // the slight upward bias at z = 0
const decades = dial("decades", 4, 1, 6, 0.1);        // how close to the singularity: τ goes 1 → 10^−decades
const count   = dial("particles", 320, 50, 800, 10);
const lab     = dial("labFrame", 0, 0, 1, 1);         // 0: move with the core (similarity) · 1: fixed lab view

const D = 0.5 - h;                                     // axial exponent
const sMax = decades * log(10);
const S = sMax * min(1, t / T);                        // s = −ln τ reached so far
const tau = exp(-S);

// the core's shape in similarity variables (ρ, ζ). ψ = ρ² g(ζ) e^(−ρ²) is the
// stream function, so u_r = −(1/r)∂ψ/∂z and u_z = (1/r)∂ψ/∂r: divergence-free.
const g  = (z) => (z + bias) * exp(-z * z / 2);       // up above the dividing layer, down below it
const gp = (z) => (1 - z * (z + bias)) * exp(-z * z / 2);
const field = (rho, zeta) => {
  const e = exp(-rho * rho);
  return {
    ur: -inflow * rho * gp(zeta) * e,                  // inward near z = 0, outward farther away
    uz: inflow * (2 - 2 * rho * rho) * g(zeta) * e,    // axial outflow along the core
    // swirl: a vortex core with the paper's exterior tail u_θ ~ r^(−1−2h)
    ut: swirl * ((1 - e) / max(rho, 1e-6)) * (1 + rho * rho) ** -h * exp(-zeta * zeta / 10),
  };
};
// how the similarity coordinates move with s (the frame itself shrinks as τ → 0)
const rates = (rho, zeta, s) => {
  const f = field(rho, zeta);
  return [f.ur + 0.5 * rho, f.uz + D * zeta, exp(h * s) * f.ut / max(rho, 1e-3)];
};

// a repeatable "random" number
const hash = (n) => { const x = sin(n * 12.9898 + 78.233) * 43758.5453; return x - floor(x); };

// where a similarity point sits on screen at time s
const place = (rho, th, zeta, s) => {
  const lr = lab ? exp(-s / 2) : 1;                    // ℓr (only in the lab frame)
  const lz = lab ? exp(-D * s) : exp(h * s);           // ℓz, or ℓz/ℓr when moving with the core
  return [lr * rho * cos(th), lz * zeta, lr * rho * sin(th)];
};

// each particle lives for `life` units of s, then is reborn somewhere new
const life = 2.4, ds = 0.03, tail = 26;
strokeWidth(1.1);
let fastest = 0;
for (let i = 0; i < count; i++) {
  const offset = (i / count) * life;
  const cycle = floor((S + life - offset) / life);
  const born = cycle * life - life + offset;          // s at which this life began (≤ S)
  if (born > S) continue;
  // most particles start inside the capture radius, where the inflow beats the
  // shrinking frame (inflow·e^(−ρ²) > 1/2): they spiral in and jet out along the
  // axis. The rest start farther out and are left behind as the core contracts.
  const inside = hash(i * 9.3) < 0.88;
  const capture = sqrt(log(2 * inflow));
  let rho = inside ? 0.2 + 0.95 * capture * hash(i * 3.7 + cycle * 11.1) : capture + 1.6 * hash(i * 3.7 + cycle * 11.1);
  let th = TAU * hash(i * 1.3 + cycle * 5.9);
  let zeta = (hash(i * 7.1 + cycle * 2.3) - 0.5) * (inside ? 1.4 : 3.2);
  const trail = [];
  const steps = floor((S - born) / ds);
  for (let k = 0; k <= steps; k++) {
    const s = born + k * ds;
    if (k >= steps - tail) {
      const f = field(rho, zeta);
      // true speed in the lab: radial ~ τ^(−1/2), swirl and axial ~ τ^(−1/2−h)
      const sp = hypot(exp(s / 2) * f.ur, exp((0.5 + h) * s) * f.ut, exp((0.5 + h) * s) * f.uz);
      trail.push([...place(rho, th, zeta, s), sp]);
    }
    // Runge–Kutta 4 in (ρ, ζ, θ)
    const a = rates(rho, zeta, s);
    const b = rates(rho + a[0] * ds / 2, zeta + a[1] * ds / 2, s + ds / 2);
    const c = rates(rho + b[0] * ds / 2, zeta + b[1] * ds / 2, s + ds / 2);
    const d = rates(rho + c[0] * ds, zeta + c[1] * ds, s + ds);
    rho = max(0, rho + (ds / 6) * (a[0] + 2 * b[0] + 2 * c[0] + d[0]));
    zeta += (ds / 6) * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
    th += (ds / 6) * (a[2] + 2 * b[2] + 2 * c[2] + d[2]);
    if (rho > 6 || abs(zeta) > 8) break;               // left the picture
  }
  if (trail.length < 2) continue;
  // fluid left behind outside the core is drawn fainter, so the core reads clearly
  const fade = min(1, (S - born) / 0.4) * min(1, (born + life - S) / 0.4) * (inside ? 1 : 0.35);
  for (let k = 0; k < trail.length - 1; k += 3) {
    const sp = trail[k][3];
    fastest = max(fastest, sp);
    // speed on a log scale: 1 → blue, up to about τ_end^−(1/2) · 2 → yellow
    const heat = clamp(log(1 + sp) / log(1 + 2 * 10 ** (0.5 * decades)), 0, 1);
    color(hsl(225 - 170 * heat, 85, 60 + 15 * heat, (0.25 + 0.6 * (k / trail.length)) * fade));
    path(trail.slice(k, k + 4).map((p) => [p[0], p[1], p[2]]));
  }
}

// the dividing layer, where the axial flow changes direction (ζ = −bias), and
// the annulus "pulses": complete rings at the core's edge, two families ±
strokeWidth(0.8);
color(232, 230, 225, 0.12);
path(range(97).map((k) => place(1.1, (TAU * k) / 96, -bias, S)));
for (let j = 0; j < 6; j++) {
  const sigma = j % 2 ? 1 : -1;
  const center = (j + 0.5) * (sMax / 6);              // each pulse grows, peaks, and fades in s
  const amp = exp(-((S - center) ** 2) / 0.6);
  if (amp < 0.02) continue;
  color(sigma > 0 ? hsl(330, 80, 72, 0.5 * amp) : hsl(185, 80, 70, 0.5 * amp));
  const r0 = 2.2 + 0.25 * j, z0 = sigma * (0.4 + 0.2 * j);
  path(range(181).map((k) => {
    const a = (TAU * k) / 180;
    return place(r0 + 0.06 * amp * sin(24 * a + 8 * S), a, z0 + 0.05 * amp * cos(24 * a + 8 * S), S);
  }));
}

// the singular point: brighter as the core's speed scale τ^−(1/2+h) grows
const flare = clamp(S / sMax, 0, 1) ** 3;
color(hsl(55, 100, 78, 0.3 + 0.7 * flare));
pointSize(3 + 22 * flare);
dot(0, 0, 0);
