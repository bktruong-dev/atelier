/// <reference lib="webworker" />
/**
 * Runs pattern code. The script is re-run from the top for every frame with
 * `t` and every dial (by its name) in scope, so a pattern is always a pure function of time.
 *
 * Safety: this is a dedicated worker, so there is no DOM, no cookies and no
 * access to the page. Network, storage and messaging globals are removed
 * below before any pattern code runs, and the page kills the worker if a
 * frame takes too long.
 */
import { API_NAMES, DEFAULT_DURATION, DEFAULT_VIEW, MAX_FLOATS, OP, badDialName } from "./ops";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const send = scope.postMessage.bind(scope);
const listen = scope.addEventListener.bind(scope);

for (const key of [
  "fetch", "XMLHttpRequest", "WebSocket", "WebTransport", "EventSource", "importScripts",
  "indexedDB", "caches", "BroadcastChannel", "Worker", "SharedWorker", "Request",
  "postMessage", "close", "navigator", "location", "addEventListener", "onmessage",
]) {
  // remove it from the global and from every prototype above it, so
  // WorkerGlobalScope.prototype.fetch (and the like) can't be reached either
  for (let o: object | null = scope; o; o = Object.getPrototypeOf(o)) {
    if (!Object.prototype.hasOwnProperty.call(o, key) && o !== scope) continue;
    try {
      Object.defineProperty(o, key, { value: undefined, writable: false, configurable: false });
    } catch {
      /* not present, or locked by the browser */
    }
  }
}

// ---- frame state ---------------------------------------------------------

let buf = new Float32Array(1 << 16);
let len = 0;
let duration = DEFAULT_DURATION;
let viewRadius = DEFAULT_VIEW;

function room(n: number) {
  if (len + n <= buf.length) return;
  let size = buf.length * 2;
  while (size < len + n) size *= 2;
  if (size > MAX_FLOATS) throw new RangeError("Too much to draw in one frame (about a million points is the limit).");
  const next = new Float32Array(size);
  next.set(buf.subarray(0, len));
  buf = next;
}

const finite = Number.isFinite;

function put3(op: number, x: number, y: number, z: number) {
  room(4);
  buf[len++] = op;
  buf[len++] = x;
  buf[len++] = y;
  buf[len++] = z;
}

// ---- the pattern API -----------------------------------------------------

/** Timeline length in seconds. Infinity (or "forever") means the pattern never ends. */
function setDuration(seconds: unknown) {
  if (seconds === Infinity || seconds === "forever" || seconds === "infinite") {
    duration = Infinity;
    return;
  }
  const s = Number(seconds);
  if (finite(s)) duration = Math.min(1e6, Math.max(0.5, s));
}

function view(radius: unknown) {
  const r = Number(radius);
  if (finite(r) && r > 0) viewRadius = r;
}

let startAngle: [number, number] | null = null;

// dial("name", value, min, max, step?) in code: returns the dial's value, and
// asks the page to create the slider if it doesn't exist yet.
let dialValues: Record<string, number | string> = {};
let dialRequests: { name: string; value: number; min: number; max: number; step: number }[] = [];
function dial(name: unknown, value: unknown = 1, min?: unknown, max?: unknown, step?: unknown): number {
  if (typeof name !== "string" || badDialName(name)) throw new TypeError(`dial needs a name you could use as a variable, like dial("speed", 1, 0, 5)`);
  const current = dialValues[name];
  if (typeof current === "number") return current;
  const v = Number(value);
  if (!finite(v)) throw new TypeError(`dial "${name}": the starting value must be a number`);
  let lo = min === undefined ? Math.min(0, v) : Number(min);
  let hi = max === undefined ? Math.max(v * 2, lo + 1) : Number(max);
  if (!finite(lo) || !finite(hi)) throw new TypeError(`dial "${name}": min and max must be numbers`);
  if (lo > hi) [lo, hi] = [hi, lo];
  if (lo === hi) hi = lo + 1;
  let st = step === undefined ? (hi - lo) / 1000 : Number(step);
  if (!finite(st) || st <= 0) st = (hi - lo) / 1000;
  if (!dialRequests.some((r) => r.name === name) && dialRequests.length < 32) dialRequests.push({ name, value: v, min: lo, max: hi, step: st });
  return Math.min(hi, Math.max(lo, v));
}
/** The starting camera angle, in degrees: turn around the vertical, then tilt. */
function orbit(yawDeg: unknown, pitchDeg: unknown = 0) {
  const y = Number(yawDeg), p = Number(pitchDeg);
  if (finite(y) && finite(p)) startAngle = [(y * Math.PI) / 180, Math.max(-90, Math.min(90, p)) * Math.PI / 180];
}

function dot(x: number, y: number, z = 0) {
  if (finite(x) && finite(y) && finite(z)) put3(OP.DOT, x, y, z);
}

type Pt = ArrayLike<number>;

function line(a: number | Pt, b: number | Pt, c?: number, d?: number) {
  if (typeof a === "number") path([[a, b as number], [c as number, d as number]]);
  else path([a, b as Pt]);
}

function path(points: unknown, closed = false) {
  if (!Array.isArray(points)) throw new TypeError("path needs an array of points, like [[0, 0], [1, 1]]");
  let open = false;
  for (const p of points as Pt[]) {
    const x = p?.[0], y = p?.[1], z = p?.[2] ?? 0;
    if (!finite(x) || !finite(y) || !finite(z)) {
      open = false; // a gap: start a new segment at the next good point
      continue;
    }
    put3(open ? OP.LINE : OP.MOVE, x, y, z);
    open = true;
  }
  room(2);
  if (closed) buf[len++] = OP.CLOSE;
  buf[len++] = OP.STROKE;
}

function setSize(op: number, px: unknown) {
  const n = Number(px);
  if (!finite(n)) return;
  room(2);
  buf[len++] = op;
  buf[len++] = Math.min(64, Math.max(0.1, n));
}
const pointSize = (px: unknown) => setSize(OP.SIZE, px);
const strokeWidth = (px: unknown) => setSize(OP.WIDTH, px);

const NAMED: Record<string, string> = { ink: "#e8e6e1", accent: "#86a8ff", dim: "#8d8b86" };

function color(c: unknown, g?: unknown, b?: unknown, a?: unknown) {
  let rgba: [number, number, number, number];
  if (typeof c === "string") rgba = parseHex(NAMED[c] ?? c);
  else rgba = [Number(c), Number(g), Number(b), a === undefined ? 1 : Number(a)];
  if (!rgba.every(finite)) throw new TypeError('color takes "#rrggbb", "ink", "accent", hsl(...) or r, g, b[, a]');
  room(5);
  buf[len++] = OP.COLOR;
  buf[len++] = clamp(rgba[0], 0, 255);
  buf[len++] = clamp(rgba[1], 0, 255);
  buf[len++] = clamp(rgba[2], 0, 255);
  buf[len++] = clamp(rgba[3], 0, 1);
}

function parseHex(s: string): [number, number, number, number] {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (!m) return [NaN, NaN, NaN, NaN];
  let h = m[1];
  if (h.length <= 4) h = [...h].map((ch) => ch + ch).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
}

/** hsl(hue 0–360, saturation 0–100, lightness 0–100, alpha 0–1) → a colour string for color(). */
function hsl(h: number, s: number, l: number, a = 1): string {
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const hex = (v: number) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}${hex(a)}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const range = (n: number) => Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => i);

// Deterministic randomness: the same seed every frame, so scrubbing is stable.
let seed = 0;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}
Math.random = random;

const MATH = Object.getOwnPropertyNames(Math).filter((k) => k !== "random");
const API: Record<string, unknown> = {
  duration: setDuration, view, orbit, dial, dot, line, path, color, hsl, pointSize, strokeWidth,
  lerp, clamp, range, random, TAU: Math.PI * 2, PHI: (1 + Math.sqrt(5)) / 2,
};
for (const k of MATH) API[k] = (Math as unknown as Record<string, unknown>)[k];
const NAMES = Object.keys(API);
if (NAMES.length !== API_NAMES.length) console.warn("API_NAMES in ops.ts is out of date");

// ---- compile and run -----------------------------------------------------

type PatternFn = (...args: unknown[]) => void;
let fn: PatternFn | null = null;
let compileError: { message: string; line: number | null } | null = null;

// new Function puts the body on line 3, and the prelude below takes one more line.
// The user's code sits in its own block so it can shadow API names (const max = …).
const HEADER_LINES = 3;
const prelude = (dials: string[]) =>
  `"use strict"; const { ${NAMES.join(", ")} } = __api; const { ${dials.join(", ")} } = __dials; {
`;

function errorInfo(err: unknown) {
  const e = err instanceof Error ? err : new Error(String(err));
  const m = /(?:<anonymous>|Function):(\d+):\d+/.exec(e.stack ?? "");
  const line = m ? Number(m[1]) - HEADER_LINES : null;
  return { message: `${e.name}: ${e.message}`.slice(0, 500), line: line && line > 0 ? line : null };
}

function compile(code: string, dials: string[]) {
  try {
    fn = new Function("__api", "__dials", "t", "T", prelude(dials) + code + "\n}") as PatternFn;
    compileError = null;
  } catch (err) {
    fn = null;
    compileError = errorInfo(err);
    if (err instanceof SyntaxError && compileError.line === null) compileError.line = findSyntaxLine(code, err.message);
  }
}

/**
 * Chrome gives no position for syntax errors in new Function. Compile
 * growing prefixes of the code: the first one that fails with the same
 * message (rather than "unexpected end of input") contains the bad line.
 */
function findSyntaxLine(code: string, message: string): number | null {
  const lines = code.split("\n");
  if (lines.length > 3000) return null;
  for (let i = 1; i <= lines.length; i++) {
    try {
      new Function(lines.slice(0, i).join("\n"));
    } catch (e) {
      if (e instanceof SyntaxError && e.message === message && !/end of input/i.test(message)) return i;
    }
  }
  return null;
}

listen("message", (e: MessageEvent) => {
  const m = e.data;
  if (!m || m.kind !== "frame" || typeof m.id !== "number") return;
  if (typeof m.code === "string") {
    const names = Array.isArray(m.names) ? m.names.filter((n: unknown) => typeof n === "string" && !badDialName(n)) : [];
    compile(m.code, names);
  }

  len = 0;
  const dials: Record<string, number | string> = {};
  if (m.values && typeof m.values === "object") {
    for (const [k, v] of Object.entries(m.values)) {
      if (typeof v === "number" || (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v))) dials[k] = v;
    }
  }
  duration = DEFAULT_DURATION;
  viewRadius = DEFAULT_VIEW;
  startAngle = null;
  dialValues = dials;
  dialRequests = [];
  seed = 0x9e3779b9;

  let error = compileError;
  if (fn && !error) {
    try {
      fn(API, dials, Number(m.t) || 0, Number(m.T) || DEFAULT_DURATION);
    } catch (err) {
      error = errorInfo(err);
    }
  }

  const out = buf.slice(0, len);
  send(
    { kind: "frame", id: m.id, buf: out, duration, view: viewRadius, orbit: startAngle, dials: dialRequests, error },
    [out.buffer],
  );
});
