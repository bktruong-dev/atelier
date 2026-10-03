// The solar system as seen from a still Earth (geocentric), the way the sky
// looked to Ptolemy: every planet loops backwards now and then (retrograde).
// The dials below create themselves the first time this runs.

duration(Infinity);

const pace   = dial("pace", 0.5, 0.05, 5, 0.05);     // years per second
const trail  = dial("trail", 6, 0.5, 40, 0.5);       // years of path behind each planet
const squash = dial("squash", 0.5, 0.25, 1, 0.05);   // 1 = true distances, 0.5 = square-root scale
view(dial("zoom", 6.2, 0.8, 32, 0.1));

//               name       a (AU)   period (yr)  colour
const planets = [
  ["Mercury", 0.387,   0.241, "#c9c2b4"],
  ["Venus",   0.723,   0.615, "#f0d49c"],
  ["Mars",    1.524,   1.881, "#ff8a6b"],
  ["Jupiter", 5.203,  11.862, "#e8b87a"],
  ["Saturn",  9.537,  29.457, "#e6d29a"],
  ["Uranus", 19.19,   84.02,  "#8fe0e8"],
  ["Neptune",30.07,  164.8,   "#86a8ff"],
];

const now = t * pace;
const around = (a, P, y) => [a * cos(TAU * y / P), a * sin(TAU * y / P)];
// a planet's position from Earth, with distances squashed so all of them fit
const fromEarth = (a, P, y) => {
  const [px, py] = around(a, P, y), [ex, ey] = around(1, 1, y);
  const dx = px - ex, dy = py - ey, r = hypot(dx, dy);
  const k = r ? r ** squash / r : 0;
  return [dx * k, dy * k];
};

// the Sun's yearly circle (from Earth it's the Sun that goes round)
const sunPts = [];
for (let y = now - min(trail, 1); y <= now; y += 0.004) sunPts.push(fromEarth(0, 1, y));
color(240, 212, 156, 0.35);
strokeWidth(1);
path(sunPts);

// each planet's trail, fading into the past
strokeWidth(1.2);
for (const [name, a, P, hex] of planets) {
  const steps = 900;
  const pts = [];
  for (let k = 0; k <= steps; k++) pts.push(fromEarth(a, P, now - trail + trail * k / steps));
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  for (let k = 0; k < steps; k += 30) {
    color(r, g, b, 0.08 + 0.8 * (k / steps) ** 1.5);
    path(pts.slice(k, k + 31));
  }
  color(hex);
  pointSize(name === "Jupiter" || name === "Saturn" ? 9 : 6);
  dot(...pts[steps]);
}

// the Sun and the Earth
color("#ffd27a");
pointSize(14);
dot(...fromEarth(0, 1, now));
color("#8fd3a8");
pointSize(8);
dot(0, 0);
