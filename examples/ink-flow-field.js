// Ink in water: hundreds of particles drifting through a slowly turning
// flow field, each leaving a fading trail. Every particle is born, drifts
// and fades on a fixed schedule, so the whole thing is a function of t:
// it runs forever and still rewinds.

duration(Infinity);
view(2.2);

const count = dial("particles", 700, 100, 1500, 10);
const swirl = dial("swirl", 1.6, 0.2, 4, 0.05);    // how curly the field is
const drift = dial("drift", 0.06, 0, 0.3, 0.01);   // how fast the field itself changes
const life  = 90;      // steps each particle lives
const tail  = 28;      // steps of trail drawn
const stepT = 0.08;    // seconds per step

// the field's direction at (x, y) and time tau: layered sines, like gentle turbulence
const angle = (x, y, tau) =>
  swirl * (sin(1.3 * x + 0.8 * sin(0.9 * y + tau)) + cos(1.1 * y - 0.5 * x + 0.6 * tau) + 0.5 * sin(2.3 * x * y + tau));

// a repeatable "random" number from any input
const hash = (n) => { const s = sin(n * 12.9898 + 78.233) * 43758.5453; return s - floor(s); };

strokeWidth(1);
for (let i = 0; i < count; i++) {
  // particle i is reborn every `life` steps; births are staggered across particles
  const offset = i * (life / count) * 7.3;
  const phase = t / stepT + offset;
  const cycle = floor(phase / life);
  const age = phase - cycle * life;
  const born = (cycle * life - offset) * stepT;     // when this life began, in seconds

  let x = hash(i * 3.1 + cycle * 17.7) * 4.4 - 2.2;
  let y = hash(i * 5.7 + cycle * 9.3) * 4.4 - 2.2;
  const steps = floor(age);
  const pts = [];
  for (let k = 0; k <= steps; k++) {
    if (k >= steps - tail) pts.push([x, y]);
    const a = angle(x, y, drift * (born + k * stepT));
    x += 0.035 * cos(a);
    y += 0.035 * sin(a);
  }
  if (pts.length < 2) continue;

  const fade = sin(PI * age / life);               // fades in when born, out before it dies
  color(hsl(205 + 130 * hash(i * 1.37), 80, 70, 0.55 * fade));
  path(pts);
}
