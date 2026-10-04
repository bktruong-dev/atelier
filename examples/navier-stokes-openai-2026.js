// Navier–Stokes blow-up, after OpenAI's "Finite time blowup for Navier–Stokes"
// (2026, Section 2). Every curve below is computed: a streamline integrated
// through the velocity field at the current moment, using the paper's scalings.
//
//   singularity at the origin at t = 1, τ = 1 − t the time remaining
//   core radius ℓr ≍ τ^(1/2), core height ℓz ≍ τ^(1/2 − h), 0 < h < 1/100
//   swirl and axial speed ≍ τ^−(1/2 + h), radial speed = O(τ^−1/2)
//
// Inside the core fluid spirals inward and leaves up and down on opposite sides
// of a dividing layer near z = 0 (with a slight upward bias). The field is
// exactly incompressible (built from a stream function) and has that shape; the
// paper's precise core profile is a numerically constructed function, so the
// shape inside the core is a model, while the scalings are the paper's.
// Colour is the true speed: blue slow → yellow fast.

orbit(30, 20);
duration(14);
view(2.6);

const h      = dial("h", 0.01, 0.005, 0.3, 0.005);  // the paper: h < 1/100. Try 0.25 to see the column stretch
const swirl  = dial("swirl", 2.4, 0.5, 6, 0.1);     // Γ, strength of the rotation
const inflow = dial("inflow", 1.6, 0.4, 4, 0.1);    // strength of the in-and-out (meridional) flow
const bias   = dial("bias", 0.15, 0, 0.5, 0.01);    // upward bias: the dividing layer sits at ζ = −bias
const lines  = dial("lines", 40, 8, 120, 1);

const D = 0.5 - h;
const tau = max(1 - t / T, 1e-3);   // time left before the singularity
const Lr = sqrt(tau);               // ℓr ~ τ^(1/2)
const Lz = tau ** D;                // ℓz ~ τ^(1/2 − h)
const Sr = tau ** -0.5;             // radial speed scale
const S = tau ** -(0.5 + h);        // swirl and axial speed scale
// how far the core has turned: ∫ Γ τ^(−1−h) dt = Γ (τ^−h − 1) / h, unbounded as τ → 0
const phase = (swirl * (tau ** -h - 1)) / h;

// the core in similarity variables ρ = r/ℓr, ζ = z/ℓz. ψ = ρ² g(ζ) e^(−ρ²) is the
// stream function, so u_r = −(1/r)∂ψ/∂z and u_z = (1/r)∂ψ/∂r: divergence-free.
const g  = (z) => (z + bias) * exp(-z * z / 2);
const gp = (z) => (1 - z * (z + bias)) * exp(-z * z / 2);
const field = (rho, zeta) => {
  const e = exp(-rho * rho);
  return [
    -inflow * rho * gp(zeta) * e,                                                        // û_r: in near z = 0, out farther away
    inflow * (2 - 2 * rho * rho) * g(zeta) * e,                                          // û_z: axial outflow
    swirl * ((1 - e) / max(rho, 1e-6)) * (1 + rho * rho) ** -h * exp(-zeta * zeta / 10), // û_θ, tail ~ r^(−1−2h)
  ];
};

// A streamline of the lab flow at this instant, written in similarity variables:
// dρ = û_r, dζ = û_z, dθ = τ^(−h) û_θ / ρ (the winding tightens as τ → 0).
const wind = tau ** -h;
const rate = (rho, zeta) => {
  const [ur, uz, ut] = field(rho, zeta);
  return [ur, uz, (wind * ut) / max(rho, 1e-3)];
};
const streamline = (rho, th, zeta) => {
  const pts = [];
  const ds = 0.02;
  for (let k = 0; k < 520; k++) {
    const [ur, uz, ut] = field(rho, zeta);
    pts.push([rho, th, zeta, hypot(Sr * ur, S * uz, S * ut)]);       // true speed here
    const a = rate(rho, zeta);                                        // Runge–Kutta 4
    const b = rate(rho + (a[0] * ds) / 2, zeta + (a[1] * ds) / 2);
    const c = rate(rho + (b[0] * ds) / 2, zeta + (b[1] * ds) / 2);
    const d = rate(rho + c[0] * ds, zeta + c[1] * ds);
    rho = max(0, rho + (ds / 6) * (a[0] + 2 * b[0] + 2 * c[0] + d[0]));
    zeta += (ds / 6) * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
    th += (ds / 6) * (a[2] + 2 * b[2] + 2 * c[2] + d[2]);
    if (abs(zeta) > 3.4) break;
  }
  return pts;
};

// similarity → the room: shrink by the real scales, turn with the core
const toWorld = ([rho, th, zeta]) => [Lr * rho * cos(th + phase), Lz * zeta, Lr * rho * sin(th + phase)];

// colour by true speed, log scale: blue at the start → yellow in the last half-percent
const top = log(1 + 3 * 0.005 ** -(0.5 + h));
const hue = (sp) => 225 - 170 * clamp(log(1 + sp) / top, 0, 1);

strokeWidth(1.1);
for (let i = 0; i < lines; i++) {
  const th0 = (TAU * i) / lines;
  const rho0 = 2.0 + 0.35 * sin(5 * th0);           // a slightly lumpy ring of starting points
  const side = i % 2 ? 1 : -1;                       // half start just above the dividing layer, half below
  const pts = streamline(rho0, th0, -bias + 0.015 * side * (1 + (i % 3)));
  for (let j = 0; j < pts.length - 1; j += 8) {
    const seg = pts.slice(j, j + 9);
    color(hsl(hue(seg[0][3]), 90, 65, 0.85));
    path(seg.map(toWorld));
  }
}

// the singular point, flaring as the speed scale τ^−(1/2+h) grows
const flare = (1 - tau) ** 6;
color(hsl(55, 100, 75, 0.25 + 0.75 * flare));
pointSize(3 + 40 * flare);
dot(0, 0, 0);
