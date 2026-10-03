/**
 * Built-in examples. They are ordinary pattern code, the same thing a user
 * writes, so every one can be opened, edited and saved as a starting point.
 */
export interface Example {
  name: string;
  code: string;
}

export const BLANK: Example = {
  name: "Untitled",
  code: `// t is the time in seconds, T is the duration.
// The whole script runs again for every frame.
const petals = dial("petals", 5, 1, 12, 1);
const turns = dial("turns", 1, 0.1, 4, 0.01);

duration(10);
view(1.2);

const pts = [];
for (let s = 0; s <= TAU * turns * t / T; s += 0.01) {
  const r = cos(petals * s);
  pts.push([r * cos(s), r * sin(s)]);
}
path(pts);
`,
};

export const EXAMPLES: Example[] = [
  {
    name: "Phyllotaxis",
    code: `// Seeds placed one after another, each turned by a fixed angle.
// The golden angle (137.508°) packs them perfectly. Try 137.0.
const angle = dial("angle", 137.508, 130, 145, 0.001);
const seeds = dial("seeds", 1500, 100, 4000, 1);
const seed = dial("seed size", 2, 0.5, 5, 0.1);

duration(20);
view(1.05);

const n = floor(seeds * t / T);
const step = angle * PI / 180;
const at = (i) => {
  const r = sqrt(i / seeds);
  return [r * cos(i * step), r * sin(i * step)];
};

pointSize(seed);
for (let i = 0; i < n; i++) dot(...at(i));

// the newest seed
color("accent");
pointSize(seed * 2);
if (n > 0) dot(...at(n - 1));
`,
  },
  {
    name: "Spirograph",
    code: `// A circle of radius r rolling inside a circle of radius R,
// with the pen d from its centre (a hypotrochoid).
const R = dial("R", 7, 1, 20, 1);
const r = dial("r", 3, 1, 20, 1);
const d = dial("d", 4, 0, 20, 0.1);

duration(12);
view(abs(R - r) + d + 0.5);

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const end = TAU * (r / gcd(R, r)) * t / T;
const k = (R - r) / r;
const pen = (s) => [(R - r) * cos(s) + d * cos(k * s), (R - r) * sin(s) - d * sin(k * s)];

const pts = [];
for (let s = 0; s <= end; s += 0.01) pts.push(pen(s));
strokeWidth(1);
path(pts);

color("accent");
pointSize(6);
dot(...pen(end));
`,
  },
  {
    name: "Harmonograph",
    code: `// Two pendulums, slowly losing energy, steer one pen.
const f1 = dial("f1", 2, 1, 6, 0.001);
const f2 = dial("f2", 3.006, 1, 6, 0.001);
const phase = dial("phase", 1.571, 0, 6.283, 0.001);
const damping = dial("damping", 0.004, 0, 0.02, 0.0001);

duration(30);
view(2.1);

const pen = (s) => {
  const e = exp(-damping * s);
  return [
    (sin(f1 * s + phase) + sin(f2 * s)) * e,
    (sin(f2 * s + phase / 2) + sin(f1 * s + 1)) * e,
  ];
};

const pts = [];
for (let s = 0; s <= 300 * t / T; s += 0.02) pts.push(pen(s));
color(232, 230, 225, 0.7);
strokeWidth(0.8);
path(pts);
`,
  },
  {
    name: "Orrery rose",
    code: `// Two planets on circular orbits. Draw a line between them
// every few days. Venus and Earth, 13 : 8, trace a five-petal flower.
const inner = dial("inner orbits", 13, 1, 30, 1);
const outer = dial("outer orbits", 8, 1, 30, 1);
const radius = dial("inner radius", 0.723, 0.1, 0.99, 0.001);
const every = dial("line every", 0.02, 0.005, 0.1, 0.001);

duration(16);
view(1.05);

const pos = (r, turns) => [r * cos(TAU * turns), r * sin(TAU * turns)];
const end = outer * t / T; // in years of the outer planet

color(232, 230, 225, 0.35);
strokeWidth(0.6);
for (let s = 0; s <= end; s += every) {
  line(pos(radius, s * inner / outer), pos(1, s));
}

color("accent");
pointSize(6);
dot(...pos(radius, end * inner / outer));
dot(...pos(1, end));
`,
  },
  {
    name: "Torus knot",
    code: `// A 3D curve wound around a doughnut, p times one way, q the other.
// Shift-drag (or the Orbit button) to turn it around.
const p = dial("p", 2, 1, 9, 1);
const q = dial("q", 3, 1, 9, 1);
const tube = dial("tube", 0.6, 0.1, 1.5, 0.01);

duration(10);
view(3);

const pts = [];
for (let s = 0; s <= TAU * t / T + 0.001; s += 0.005) {
  const ring = 2 + tube * cos(q * s);
  pts.push([ring * cos(p * s), ring * sin(p * s), tube * sin(q * s)]);
}
strokeWidth(1.4);
color(hsl(225, 100, 76));
path(pts);
`,
  },
];
