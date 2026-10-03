// Navier–Stokes blow-up: a picture of OpenAI's 2026 construction.
// An axisymmetric swirling core: fluid spirals inward, then shoots out
// along the axis both ways. The core narrows (radially faster than
// axially), spins faster and faster, and its speed blows up at t = T.
// Illustrative model of the reported shape, not the paper's exact profile.

orbit(30, 20);
duration(14);
view(2.6);

const h = 0.25;                  // anisotropy: A = 1/2 + h, D = 1/2 - h
const A = 0.5 + h, D = 0.5 - h;
const swirl = 2.4;               // how strongly the core spins
const lines = 40;                // streamlines drawn

const q = max(1 - t / T, 1e-3);  // time left before the singularity
const Lr = sqrt(q);              // radial width   ~ q^(1/2)
const Lz = q ** D;               // axial length   ~ q^(1/2 - h): shrinks slower
const S = q ** -A;               // speed scale    ~ q^-(1/2 + h): blows up
// total turning of the core, the integral of u_θ / r: unbounded as q → 0
const phase = swirl * (q ** -h - 1) / h;

// one streamline of the self-similar profile, in (ρ, θ, ζ)
const stream = (rho, th, zeta) => {
  const pts = [];
  for (let k = 0; k < 420; k++) {
    const omega = swirl * (1 - exp(-rho * rho)) / (rho * rho) * exp(-zeta * zeta / 6);
    pts.push([rho, th, zeta, hypot(0.5 * rho, omega * rho, zeta)]);
    const ds = 0.02;
    rho -= 0.5 * rho * ds;       // drawn inward
    th += omega * ds;            // swirled round
    zeta += zeta * ds;           // pushed out along the axis
    if (abs(zeta) > 3.2) break;
  }
  return pts;
};

// similarity space → the room: shrink by the collapsing scales, spin by the phase
const toWorld = ([rho, th, zeta]) => [Lr * rho * cos(th + phase), Lz * zeta, Lr * rho * sin(th + phase)];

// colour by true speed: blue slow → yellow fast (log scale)
const hue = (sp) => 225 - 170 * clamp(log(1 + sp * S) / log(1 + 500), 0, 1);

strokeWidth(1.1);
for (let i = 0; i < lines; i++) {
  const th0 = TAU * i / lines;
  const rho0 = 2.0 + 0.35 * sin(5 * th0);   // a slightly lumpy ring of starting points
  const up = i % 2 ? 1 : -1;                // half leave upward, half downward
  const pts = stream(rho0, th0, 0.015 * up * (1 + (i % 3)));
  for (let j = 0; j < pts.length - 1; j += 8) {
    const seg = pts.slice(j, j + 9);
    color(hsl(hue(seg[0][3]), 90, 65, 0.85));
    path(seg.map(toWorld));
  }
}

// the singular point, flaring as the speed blows up
const flare = (1 - q) ** 6;
color(hsl(55, 100, 75, 0.25 + 0.75 * flare));
pointSize(3 + 40 * flare);
dot(0, 0, 0);
