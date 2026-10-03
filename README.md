# Atelier

A notebook for building mathematical patterns in code, a bit like Desmos with a code editor. Each page is a canvas: make dials for your variables, write a few lines that use them, and watch the pattern grow. Play, pause, scrub, rewind or fast-forward it from 0.25× to 100×, animate any dial, and pan, zoom or turn the result in 3D.

> Work in progress. A screenshot and the live link will be added here.

## The notebook

The header holds your pages. **Phyllotaxis** is the reference page, there to read and play with; **+** opens a new page. Pages save automatically in your browser. **Share** copies a link that recreates the page, code and dials included.

## Dials

A dial is a variable. Add one with **+ dial**, then use its name in the code. Each dial has:

- a slider and an editable value (typing past an end stretches the range)
- editable min and max at the ends of the slider, and a step
- **▶** to animate it at its *rate* (units per second), bouncing, looping or once

Renaming a dial renames it in the code too.

## Writing a pattern

The script runs again for every frame, with `t` set to the current time, so whatever it draws is the picture *at time t*. Scrubbing and rewinding just pick a different `t`, so playback is exact at any speed. With a dial `k`:

```js
duration(10); // the timeline is 10 seconds long
view(1.2);    // show 1.2 units from the centre

const pts = [];
for (let s = 0; s <= TAU * t / T; s += 0.01) {
  const r = cos(k * s);
  pts.push([r * cos(s), r * sin(s)]);
}
path(pts);
```

| | |
|---|---|
| `t`, `T` | current time and duration, in seconds |
| your dials | each dial by its name |
| `duration(seconds)` | length of the timeline (default 10) |
| `view(radius)` | how much of the plane is visible (default 2) |
| `dot(x, y, z?)` | a point |
| `line(x1, y1, x2, y2)` or `line([x, y, z], [x, y, z])` | a segment |
| `path(points, closed?)` | a curve through `[[x, y, z?], …]` |
| `color(c)` | `"#86a8ff"`, `"ink"`, `"accent"`, `hsl(h, s, l, a?)`, or `r, g, b, a?` |
| `pointSize(px)`, `strokeWidth(px)` | sizes in screen pixels |
| Math | `sin`, `cos`, `sqrt`, `PI` and the rest without `Math.`, plus `TAU`, `PHI`, `lerp`, `clamp`, `range`, `random` |

`random()` is seeded and gives the same sequence every frame, so patterns stay stable while you scrub. Give points a `z`, turn on **Orbit** (or hold Shift and drag) to look at them in 3D.

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
  render.ts     draws a frame and the grid through the camera (pan, zoom, 3D)
  presets.ts    the reference page and the new-page template
  notebook.ts   pages and dials (localStorage)
  share.ts      share links
  ui/           editor, dials, timeline, camera controls
```

## License

[MIT](LICENSE) © Benjamin Truong
