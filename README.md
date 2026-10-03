# Atelier

A browser instrument for building mathematical patterns in code. Write a few lines, give your variables dials, and watch the pattern grow. You can play, pause, scrub, rewind and fast-forward it from 0.25× to 100×, and pan, zoom or turn it in 3D.

> Work in progress. A screenshot and the live link will be added here.

## Writing a pattern

A pattern is a short script. It runs again for every frame, with `t` set to the current time, so whatever it draws is the picture *at time t*. Scrubbing and rewinding just pick a different `t`, so playback is exact at any speed.

```js
const petals = dial("petals", 5, 1, 12, 1); // a slider: name, value, min, max, step

duration(10); // the timeline is 10 seconds long
view(1.2);    // show 1.2 units from the centre

const pts = [];
for (let s = 0; s <= TAU * t / T; s += 0.01) {
  const r = cos(petals * s);
  pts.push([r * cos(s), r * sin(s)]);
}
path(pts);
```

| | |
|---|---|
| `t`, `T` | current time and duration, in seconds |
| `dial(name, value, min, max, step?)` | makes a slider and returns its value |
| `duration(seconds)` | length of the timeline (default 10) |
| `view(radius)` | how much of the plane is visible (default 2) |
| `dot(x, y, z?)` | a point |
| `line(x1, y1, x2, y2)` or `line([x, y, z], [x, y, z])` | a segment |
| `path(points, closed?)` | a curve through `[[x, y, z?], …]` |
| `color(c)` | `"#86a8ff"`, `"ink"`, `"accent"`, `hsl(h, s, l, a?)`, or `r, g, b, a?` |
| `pointSize(px)`, `strokeWidth(px)` | sizes in screen pixels |
| Math | `sin`, `cos`, `sqrt`, `PI` and the rest without `Math.`, plus `TAU`, `PHI`, `lerp`, `clamp`, `range`, `random` |

`random()` is seeded and gives the same sequence every frame, so patterns stay stable while you scrub. Give points a `z` and turn on **Orbit** (or hold Shift and drag) to look at them in 3D.

Patterns you save are kept in your browser. **Share** copies a link that contains the code and dial settings.

## Safety

Pattern code, including code arriving in a share link, runs in a Web Worker with no access to the page, network, cookies or storage. A frame that takes longer than 2 seconds stops the worker. The page has a strict Content-Security-Policy; only the worker file is allowed to compile code.

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev
```

`npm run build` type-checks and writes the static site to `dist/`.

```
src/
  sandbox/      the worker that runs pattern code, and the page side that talks to it
  render.ts     draws a frame through the camera (pan, zoom, 3D rotation)
  presets.ts    built-in examples, written as ordinary pattern code
  library.ts    saved patterns (localStorage)
  share.ts      share links
  ui/           editor, dials, timeline, camera controls
```

## License

[MIT](LICENSE) © Benjamin Truong
