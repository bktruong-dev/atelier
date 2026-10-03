// Fourier epicycles: any closed drawing is a sum of spinning circles.
// Each circle turns at a whole-number speed; chained tip to tip, the last
// one's pen traces the shape. Fewer circles give a rougher sketch.

duration(12);
view(1.25);

const circles  = dial("circles", 24, 1, 128, 1);   // how many epicycles to use
const shape    = dial("shape", 0, 0, 2, 1);        // 0 heart · 1 star · 2 butterfly
const ghost    = dial("ghost", 0.25, 0, 1, 0.05);  // how strongly to show the target

// the target drawing, as N points on a closed curve (about ±1 across)
const N = 256;
const target = range(N).map((k) => {
  const s = TAU * k / N;
  if (shape === 0) {          // heart
    return [16 * sin(s) ** 3 / 17, (13 * cos(s) - 5 * cos(2 * s) - 2 * cos(3 * s) - cos(4 * s)) / 17];
  } else if (shape === 1) {   // five-pointed star
    const r = 0.45 + 0.55 * abs(cos(2.5 * s)) ** 4;
    return [r * sin(s), r * cos(s)];
  } else {                    // Temple Fay's butterfly curve
    const u = s * 6;
    const r = exp(cos(u)) - 2 * cos(4 * u) - sin(u / 12) ** 5;
    return [0.22 * r * sin(u), 0.22 * r * cos(u) - 0.15];
  }
});

// discrete Fourier transform: each frequency f becomes one circle
const terms = [];
for (let f = -N / 2; f < N / 2; f++) {
  let re = 0, im = 0;
  for (let k = 0; k < N; k++) {
    const a = -TAU * f * k / N;
    re += target[k][0] * cos(a) - target[k][1] * sin(a);
    im += target[k][0] * sin(a) + target[k][1] * cos(a);
  }
  terms.push({ f, re: re / N, im: im / N, amp: hypot(re, im) / N });
}
terms.sort((a, b) => b.amp - a.amp);   // biggest circles first
const used = terms.slice(0, circles);

// where the pen is at angle s (and, if asked, every circle centre on the way)
const pen = (s, chain) => {
  let x = 0, y = 0;
  for (const c of used) {
    const a = c.f * s;
    const nx = x + c.re * cos(a) - c.im * sin(a);
    const ny = y + c.re * sin(a) + c.im * cos(a);
    if (chain) chain.push([x, y, c.amp]);
    x = nx;
    y = ny;
  }
  return [x, y];
};

// the ghost of the target
if (ghost > 0) {
  color(232, 230, 225, ghost * 0.5);
  strokeWidth(1);
  path(target, true);
}

// the line traced so far
const sNow = TAU * min(1, t / T);
const traced = [];
for (let s = 0; s <= sNow; s += TAU / 600) traced.push(pen(s));
traced.push(pen(sNow));
color("#f2a6c4");
strokeWidth(2);
path(traced);

// the circles, chained tip to tip
const chain = [];
const tip = pen(sNow, chain);
strokeWidth(0.8);
color(134, 168, 255, 0.35);
for (const [x, y, r] of chain) {
  path(range(49).map((k) => [x + r * cos(TAU * k / 48), y + r * sin(TAU * k / 48)]));
}
color(232, 230, 225, 0.6);
path([...chain.map(([x, y]) => [x, y]), tip]);
color("ink");
pointSize(6);
dot(...tip);
