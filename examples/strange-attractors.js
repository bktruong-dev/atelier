// Three strange attractors in 3D: deterministic chaos. One point follows
// simple equations forever without ever repeating, and its path draws
// the shape. Drag with Orbit on (or Shift-drag) to walk around it.

orbit(30, 18);
duration(30);
view(2.4);

const which  = dial("which", 0, 0, 2, 1);               // 0 Aizawa · 1 Thomas · 2 Halvorsen
const length = dial("length", 14000, 2000, 40000, 500);  // steps to follow
const width  = dial("thickness", 0.8, 0.3, 2, 0.1);

// each attractor: its equations, a time step, a start point and a scale to fit
const systems = [
  { dt: 0.01, p: [0.1, 0, 0], scale: 1.1,      // Aizawa
    f: ([x, y, z]) => [(z - 0.7) * x - 3.5 * y, 3.5 * x + (z - 0.7) * y,
      0.6 + 0.95 * z - z ** 3 / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x ** 3] },
  { dt: 0.06, p: [1.1, 1.1, -0.01], scale: 0.4, // Thomas
    f: ([x, y, z]) => [sin(y) - 0.208186 * x, sin(z) - 0.208186 * y, sin(x) - 0.208186 * z] },
  { dt: 0.012, p: [-1.48, -1.51, 2.04], scale: 0.15, // Halvorsen
    f: ([x, y, z]) => [-1.89 * x - 4 * y - 4 * z - y * y, -1.89 * y - 4 * z - 4 * x - z * z, -1.89 * z - 4 * x - 4 * y - x * x] },
];
const sys = systems[which];

// follow the point with Runge–Kutta (4th order), as far as the timeline has got
const steps = floor(length * min(1, t / T));
const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
let p = sys.p.slice();
const pts = [], speeds = [];
for (let i = 0; i < steps; i++) {
  const k1 = sys.f(p), k2 = sys.f(add(p, k1, sys.dt / 2)), k3 = sys.f(add(p, k2, sys.dt / 2)), k4 = sys.f(add(p, k3, sys.dt));
  p = [0, 1, 2].map((j) => p[j] + (sys.dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
  pts.push([p[0] * sys.scale, p[2] * sys.scale, p[1] * sys.scale]);   // z drawn upwards
  speeds.push(hypot(k1[0], k1[1], k1[2]));
}

// centre the shape on the origin, using where the point spends its time
if (pts.length) {
  const c = [0, 0, 0];
  for (const q of pts) { c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; }
  for (const q of pts) { q[0] -= c[0] / pts.length; q[1] -= c[1] / pts.length; q[2] -= c[2] / pts.length; }
}

// colour by speed: slow violet to fast gold, drawn in short pieces
let top = 1;
for (let i = 0; i < min(speeds.length, 3000); i++) top = max(top, speeds[i]);
strokeWidth(width);
for (let i = 0; i < pts.length - 1; i += 40) {
  color(hsl(265 - 220 * min(1, speeds[i] / top), 85, 68, 0.7));
  path(pts.slice(i, i + 41));
}
if (pts.length) {
  color("ink");
  pointSize(6);
  dot(...pts[pts.length - 1]);
}
