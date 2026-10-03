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
