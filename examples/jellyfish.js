// A deep-sea jellyfish, glowing. It swims forever, pulsing as it goes.
// Its tentacles trail through the places the bell has already been,
// so everything is a function of t: rewind and it swims backwards.

duration(Infinity);
view(2.1);

const pulse = 2.4;        // bell beats per second, roughly
const lag = 0.1;          // how far back in time each tentacle bead looks
const beads = 64;         // beads per tentacle
const tentacles = 11;

// the bell's path: a slow wander, with a shove on every pulse
const head = (s) => [
  1.15 * sin(0.21 * s) + 0.12 * cos(0.9 * s) + 0.05 * sin(pulse * s),
  0.75 * sin(0.13 * s + 1) + 0.05 * sin(pulse * s + 1),
];
// which way it's swimming at time s: forward f and sideways n
const frame = (s) => {
  const [ax, ay] = head(s - 0.02), [bx, by] = head(s + 0.02);
  const l = hypot(bx - ax, by - ay) || 1;
  const f = [(bx - ax) / l, (by - ay) / l];
  return [f, [-f[1], f[0]]];
};
const at = (c, f, n, a, b) => [c[0] + f[0] * a + n[0] * b, c[1] + f[1] * a + n[1] * b];

// marine snow drifting upwards, faint (random() is seeded, so it's the same every frame)
pointSize(1.5);
for (let i = 0; i < 70; i++) {
  const x = random() * 5 - 2.5;
  const y = ((random() * 5 + 0.04 * t) % 5) - 2.5;
  color(143, 247, 207, 0.08 + 0.12 * random());
  dot(x + 0.05 * sin(t * 0.3 + i), y);
}

const c = head(t);
const [f, n] = frame(t);
const R = 0.34 * (1 - 0.12 * sin(pulse * t));   // the bell contracts on each beat

// tentacles: bead k sits where the bell's rim was k·lag seconds ago
for (let i = 0; i < tentacles; i++) {
  const u = (i / (tentacles - 1) - 0.5) * 1.8;   // across the rim, side to side
  for (let k = beads - 1; k >= 0; k--) {
    const s = t - k * lag;
    const ck = head(s);
    const [fk, nk] = frame(s);
    const fade = 1 - k / beads;
    const sway = 0.14 * sin(k * 0.23 - 3 * t + i * 1.7) * (k / beads);
    const p = at(ck, fk, nk, -0.05, R * u * (0.55 + 0.45 * fade) + sway);
    color(143, 247, 207, 0.85 * fade ** 1.2);
    pointSize(1 + 7 * fade ** 1.4);
    dot(...p);
  }
}

// the bell: a dome of light facing the way it swims
for (let j = 1; j <= 7; j++) {
  const r = R * j / 7;
  for (let a = -PI / 2; a <= PI / 2 + 1e-6; a += PI / (6 + j * 3)) {
    color(160, 255, 220, j === 7 ? 0.95 : 0.25 + 0.06 * j);
    pointSize(j === 7 ? 4 : 3);
    dot(...at(c, f, n, r * cos(a) * 0.85, r * sin(a)));
  }
}
