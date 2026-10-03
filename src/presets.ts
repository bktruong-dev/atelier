import { makeDial, type Dial } from "./notebook";

/**
 * The reference page, and the template for a new page. Both are ordinary
 * pattern code plus dials, the same as anything a user makes.
 */
export interface Template {
  name: string;
  code: string;
  dials: Dial[];
}

export const REFERENCE: Template = {
  name: "Phyllotaxis",
  dials: [
    { ...makeDial("angle", 137.508, 130, 145, 0.001), rate: 0.05 },
    makeDial("seeds", 1500, 100, 4000, 1),
    makeDial("seedSize", 2, 0.5, 5, 0.1),
  ],
  code: `// Phyllotaxis: seeds placed one after another, each turned by a fixed angle.
// The golden angle (137.508°) packs them perfectly. Drag "angle" to 137.0,
// or press ▶ on it and watch the spirals appear and dissolve.
//
// Dials are variables: angle, seeds and seedSize are used below by name.

duration(20);
view(1.05);

const n = floor(seeds * t / T);
const step = angle * PI / 180;
const at = (i) => {
  const r = sqrt(i / seeds);
  return [r * cos(i * step), r * sin(i * step)];
};

pointSize(seedSize);
for (let i = 0; i < n; i++) dot(...at(i));

// the newest seed
color("accent");
pointSize(seedSize * 2);
if (n > 0) dot(...at(n - 1));
`,
};

export const LORENZ: Template = {
  name: "Lorenz",
  dials: [
    { ...makeDial("sigma", 10, 1, 20, 0.01), rate: 0.5 },
    { ...makeDial("rho", 28, 1, 50, 0.01), rate: 1 },
    makeDial("beta", 2.667, 0.5, 5, 0.001),
    makeDial("gap", 0.0001, 0, 0.01, 0.0001),
  ],
  code: `// The Lorenz attractor: three equations for air rolling in a heated box.
// It never repeats and never settles. Two trails start "gap" apart; for a
// while they agree, then chaos pulls them onto different wings.
//
// It's 3D: drag with Orbit on (or Shift-drag) to walk around it.

orbit(45, 12);    // starting camera angle in degrees: face the two wings
duration(30);
view(36);

const dt = 0.005;
const steps = floor(9000 * t / T);

const trail = (x, y, z) => {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;
    x += dx * dt;
    y += dy * dt;
    z += dz * dt;
    pts.push([x, z - rho, y]); // draw z upwards
  }
  return pts;
};

const a = trail(1, 1, 1);
const b = trail(1 + gap, 1, 1);

strokeWidth(0.8);
color(134, 168, 255, 0.6);
path(a);
color(217, 184, 120, 0.6);
path(b);

// the two pens
pointSize(6);
color("#b8ccff");
if (steps) dot(...a[steps - 1]);
color("#f0d49c");
if (steps) dot(...b[steps - 1]);
`,
};

export const REFERENCES: Template[] = [REFERENCE, LORENZ];

/** A truly empty page, for "Blank new pages" in settings. */
export const EMPTY: Template = {
  name: "Untitled",
  dials: [],
  code: `// A blank canvas. t is the time in seconds.
// Try: dot(cos(t), sin(t));

`,
};

export const BLANK: Template = {
  name: "Untitled",
  dials: [makeDial("k", 5, 1, 12, 1)],
  code: `// A new page. t is the time in seconds, T the duration.
// Add dials on the right and use them here by name, like k.

duration(10);
view(1.2);

const pts = [];
for (let s = 0; s <= TAU * t / T; s += 0.01) {
  const r = cos(k * s);
  pts.push([r * cos(s), r * sin(s)]);
}
path(pts);
`,
};
