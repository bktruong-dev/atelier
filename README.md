# Atelier

A browser instrument for mathematical patterns. Pick a pattern or write your own, turn the dials, and watch it grow. You can play, pause, scrub, rewind and fast-forward it from 0.25× to 100×.

> Work in progress. Screenshots, the live link and the guide to writing patterns will be added as the project takes shape.

## Idea

Every pattern is a pure function of time, `draw(t)` or `point(i, t)`. Rewinding or scrubbing just evaluates an earlier `t`, so playback at any speed stays exact.

Code you write yourself runs in a sandbox (a Web Worker) with time and step limits. A share link can carry code, so the page treats every link as untrusted.

## Run locally

_Coming soon._

## License

[MIT](LICENSE) © Benjamin Truong
