// Conway's Game of Life, rewindable. Every frame replays the world from
// generation 0 up to generation floor(t × speed), so scrubbing back in time
// really does un-live it. Cells glow warmer the longer they survive.

duration(60);
view(34);

const speed   = dial("speed", 8, 1, 30, 1);         // generations per second
const density = dial("density", 0.3, 0.05, 0.6, 0.01);
const seed    = dial("seed", 1, 1, 50, 1);          // a different random world
const start   = dial("start", 0, 0, 1, 1);          // 0 random soup · 1 Gosper glider gun
const cell    = dial("cellSize", 8, 2, 16, 0.5);    // dot size in pixels

const W = 64, H = 40;
let grid = new Uint8Array(W * H);
let age = new Uint16Array(W * H);

if (start === 1) {
  // Bill Gosper's glider gun (1970): it fires a new glider every 30 generations
  const gun = [[24,0],[22,1],[24,1],[12,2],[13,2],[20,2],[21,2],[34,2],[35,2],[11,3],[15,3],[20,3],[21,3],
    [34,3],[35,3],[0,4],[1,4],[10,4],[16,4],[20,4],[21,4],[0,5],[1,5],[10,5],[14,5],[16,5],[17,5],[22,5],[24,5],
    [10,6],[16,6],[24,6],[11,7],[15,7],[12,8],[13,8]];
  for (const [x, y] of gun) grid[(y + 4) * W + (x + 4)] = 1;
} else {
  for (let s = 0; s < seed * 7; s++) random();      // the seed dial skips ahead in the random sequence
  for (let i = 0; i < W * H; i++) grid[i] = random() < density ? 1 : 0;
}

// play the world forward, wrapping round the edges
const gens = floor(t * speed);
let next = new Uint8Array(W * H);
for (let g = 0; g < gens; g++) {
  for (let y = 0; y < H; y++) {
    const up = ((y + H - 1) % H) * W, mid = y * W, dn = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const l = (x + W - 1) % W, r = (x + 1) % W;
      const n = grid[up + l] + grid[up + x] + grid[up + r] + grid[mid + l] + grid[mid + r] + grid[dn + l] + grid[dn + x] + grid[dn + r];
      const alive = grid[mid + x] ? n === 2 || n === 3 : n === 3;
      next[mid + x] = alive ? 1 : 0;
      age[mid + x] = alive ? age[mid + x] + 1 : 0;
    }
  }
  [grid, next] = [next, grid];
}

pointSize(cell);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!grid[i]) continue;
    const a = min(age[i], 60) / 60;                  // young: cool blue · old: warm gold
    color(hsl(220 - 175 * a, 80, 60 + 15 * a, 0.55 + 0.45 * a));
    dot(x - W / 2 + 0.5, H / 2 - y - 0.5);
  }
}
