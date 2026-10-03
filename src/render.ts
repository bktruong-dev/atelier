import { OP } from "./sandbox/ops";

/** yaw/pitch rotate the world; zoom scales it; ox/oy pan it, in CSS pixels. */
export interface Camera {
  yaw: number;
  pitch: number;
  zoom: number;
  ox: number;
  oy: number;
}

export const newCamera = (): Camera => ({ yaw: 0, pitch: 0, zoom: 1, ox: 0, oy: 0 });

export interface Frame {
  buf: Float32Array;
  view: number; // world units from the centre to the nearest edge, at zoom 1
}

const TAU = Math.PI * 2;
const INK = "rgba(232,230,225,1)";

/** World (x, y up, z towards you) → rotated (X right, Y up). */
function rotator(cam: Camera) {
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const out = { X: 0, Y: 0 };
  return (x: number, y: number, z: number) => {
    const z1 = -x * sy + z * cy;
    out.X = x * cy + z * sy;
    out.Y = y * cp - z1 * sp;
    return out;
  };
}

export function scaleOf(width: number, height: number, frame: Frame, cam: Camera) {
  return (Math.min(width, height) / 2 / frame.view) * cam.zoom;
}

export interface DrawOptions {
  grid: boolean;
  /** A soft bloom under the strokes. Skipped on phones. */
  glow: boolean;
}

export function drawFrame(ctx: CanvasRenderingContext2D, width: number, height: number, frame: Frame, cam: Camera, opts: DrawOptions) {
  ctx.clearRect(0, 0, width, height);
  drawPattern(ctx, width, height, frame, cam);

  if (opts.glow) addGlow(ctx, width, height);
  // the grid goes underneath what is already drawn
  if (opts.grid) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.drawImage(cachedGrid(ctx, width, height, frame, cam), 0, 0, width, height);
    ctx.restore();
  }
  if (!isFlat(cam)) drawGizmo(ctx, width, height, cam);
}

// The grid only changes when the camera or canvas does, so it is drawn once
// into its own canvas and reused while the pattern animates.
let gridCanvas: HTMLCanvasElement | null = null;
let gridKey = "";
function cachedGrid(ctx: CanvasRenderingContext2D, width: number, height: number, frame: Frame, cam: Camera) {
  const src = ctx.canvas;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb");
  const key = [src.width, src.height, frame.view, cam.zoom, cam.ox, cam.oy, cam.yaw, cam.pitch, accent].join();
  gridCanvas ??= document.createElement("canvas");
  if (key !== gridKey) {
    gridKey = key;
    gridCanvas.width = src.width;
    gridCanvas.height = src.height;
    const g = gridCanvas.getContext("2d")!;
    g.setTransform(src.width / width, 0, 0, src.height / height, 0, 0);
    drawGrid(g, width, height, frame, cam);
  }
  return gridCanvas;
}

// The glow is made at a quarter of the resolution: shrink the pattern, blur it
// a little, and stretch it back over the original. Far cheaper than blurring
// the full-size canvas, and the upscale softens it for free.
let glowCanvas: HTMLCanvasElement | null = null;
function addGlow(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const src = ctx.canvas;
  const gw = Math.max(1, Math.round(width / 4)), gh = Math.max(1, Math.round(height / 4));
  glowCanvas ??= document.createElement("canvas");
  if (glowCanvas.width !== gw || glowCanvas.height !== gh) {
    glowCanvas.width = gw;
    glowCanvas.height = gh;
  }
  const g = glowCanvas.getContext("2d")!;
  g.clearRect(0, 0, gw, gh);
  g.filter = "blur(2px)";
  g.drawImage(src, 0, 0, gw, gh);
  g.filter = "none";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.55;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(glowCanvas, 0, 0, width, height);
  ctx.restore();
}

const isFlat = (cam: Camera) => Math.abs(cam.yaw) < 1e-6 && Math.abs(cam.pitch) < 1e-6;

const AXES = [
  { name: "x", v: [1, 0, 0], color: "232,160,122" },
  { name: "y", v: [0, 1, 0], color: "143,211,168" },
  { name: "z", v: [0, 0, 1], color: "134,168,255" },
] as const;

/** A small x/y/z compass in the corner while the view is rotated. */
function drawGizmo(ctx: CanvasRenderingContext2D, width: number, height: number, cam: Camera) {
  const rot = rotator(cam);
  const cx = width - 46, cy = height - 46, r = 24;
  ctx.save();
  ctx.fillStyle = "rgba(12,13,16,0.7)";
  ctx.strokeStyle = "rgba(232,230,225,0.12)";
  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.font = "500 10px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineCap = "round";
  ctx.lineWidth = 1.6;
  for (const a of AXES) {
    const p = rot(a.v[0], a.v[1], a.v[2]);
    const x = cx + p.X * r, y = cy - p.Y * r;
    ctx.strokeStyle = `rgba(${a.color},0.9)`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = `rgb(${a.color})`;
    ctx.fillText(a.name, cx + p.X * (r + 8), cy - p.Y * (r + 8));
  }
  ctx.restore();
}

function drawPattern(ctx: CanvasRenderingContext2D, width: number, height: number, frame: Frame, cam: Camera) {
  const b = frame.buf;
  const n = b.length;
  const k = scaleOf(width, height, frame, cam);
  const cx = width / 2 + cam.ox;
  const cy = height / 2 + cam.oy;
  const rot = rotator(cam);

  let style = INK;
  let size = 2;
  let width_ = 1;
  let dots = false;
  let path = false;

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const flushDots = () => {
    if (dots) ctx.fill();
    dots = false;
  };
  const flushPath = () => {
    if (path) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width_;
      ctx.stroke();
    }
    path = false;
  };

  for (let i = 0; i < n; ) {
    switch (b[i]) {
      case OP.COLOR:
        flushDots();
        flushPath();
        style = `rgba(${b[i + 1] | 0},${b[i + 2] | 0},${b[i + 3] | 0},${b[i + 4]})`;
        i += 5;
        break;
      case OP.SIZE:
        flushDots();
        size = b[i + 1];
        i += 2;
        break;
      case OP.WIDTH:
        flushPath();
        width_ = b[i + 1];
        i += 2;
        break;
      case OP.DOT: {
        flushPath();
        if (!dots) {
          ctx.beginPath();
          ctx.fillStyle = style;
          dots = true;
        }
        const p = rot(b[i + 1], b[i + 2], b[i + 3]);
        const x = cx + p.X * k, y = cy - p.Y * k, r = size / 2;
        if (r <= 1) ctx.rect(x - r, y - r, size, size);
        else {
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, TAU);
        }
        i += 4;
        break;
      }
      case OP.MOVE:
      case OP.LINE: {
        flushDots();
        if (!path) {
          ctx.beginPath();
          path = true;
        }
        const p = rot(b[i + 1], b[i + 2], b[i + 3]);
        if (b[i] === OP.MOVE) ctx.moveTo(cx + p.X * k, cy - p.Y * k);
        else ctx.lineTo(cx + p.X * k, cy - p.Y * k);
        i += 4;
        break;
      }
      case OP.CLOSE:
        if (path) ctx.closePath();
        i += 1;
        break;
      case OP.STROKE:
        flushPath();
        i += 1;
        break;
      default:
        i = n; // unknown op: stop rather than misread the rest
    }
  }
  flushDots();
  flushPath();
}

/** Zoom and pan so everything in the frame fills the canvas. */
export function fitCamera(width: number, height: number, frame: Frame, cam: Camera) {
  const b = frame.buf;
  const rot = rotator(cam);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < b.length; ) {
    const op = b[i];
    if (op === OP.DOT || op === OP.MOVE || op === OP.LINE) {
      const p = rot(b[i + 1], b[i + 2], b[i + 3]);
      if (p.X < minX) minX = p.X;
      if (p.X > maxX) maxX = p.X;
      if (p.Y < minY) minY = p.Y;
      if (p.Y > maxY) maxY = p.Y;
      i += 4;
    } else if (op === OP.COLOR) i += 5;
    else if (op === OP.SIZE || op === OP.WIDTH) i += 2;
    else i += 1;
  }
  if (!finite(minX)) return;
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const k = 0.9 * Math.min(width / spanX, height / spanY);
  cam.zoom = k / (Math.min(width, height) / 2 / frame.view);
  cam.ox = -((minX + maxX) / 2) * k;
  cam.oy = ((minY + maxY) / 2) * k;
}

const finite = Number.isFinite;

/** A "nice" grid step (1, 2 or 5 × 10ⁿ) about `px` pixels apart at scale k. */
function niceStep(k: number, px: number) {
  const raw = px / k;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/**
 * Graph-paper grid on the z = 0 plane: minor lines, major lines every 5, and
 * the axes. It goes through the same camera as the pattern, so it pans, zooms
 * and tilts with it. Labels only while the view is flat.
 */
function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, frame: Frame, cam: Camera) {
  const k = scaleOf(width, height, frame, cam);
  const cx = width / 2 + cam.ox;
  const cy = height / 2 + cam.oy;
  const rot = rotator(cam);
  const flat = isFlat(cam);
  const step = niceStep(k, 28);
  const major = step * 5;

  // the world point at the screen centre (exact when flat), and a radius covering the screen
  const wx = -cam.ox / k, wy = cam.oy / k;
  const reach = (Math.hypot(width, height) / 2 / k) * (flat ? 1 : 3);
  const x0 = Math.floor((wx - reach) / step), x1 = Math.ceil((wx + reach) / step);
  const y0 = Math.floor((wy - reach) / step), y1 = Math.ceil((wy + reach) / step);
  if (x1 - x0 > 600 || y1 - y0 > 600) return;

  const seg = (ax: number, ay: number, bx: number, by: number) => {
    const a = rot(ax, ay, 0);
    const pax = cx + a.X * k, pay = cy - a.Y * k;
    const b = rot(bx, by, 0);
    ctx.moveTo(pax, pay);
    ctx.lineTo(cx + b.X * k, cy - b.Y * k);
  };
  const lines = (which: "minor" | "major" | "axis") => {
    ctx.beginPath();
    for (let i = x0; i <= x1; i++) {
      const x = i * step;
      const isAxis = i === 0, isMajor = Math.abs(Math.round(x / major) * major - x) < step / 2;
      if ((which === "axis") !== isAxis || (which === "major" && !isMajor) || (which === "minor" && (isMajor || isAxis))) continue;
      seg(x, y0 * step, x, y1 * step);
    }
    for (let j = y0; j <= y1; j++) {
      const y = j * step;
      const isAxis = j === 0, isMajor = Math.abs(Math.round(y / major) * major - y) < step / 2;
      if ((which === "axis") !== isAxis || (which === "major" && !isMajor) || (which === "minor" && (isMajor || isAxis))) continue;
      seg(x0 * step, y, x1 * step, y);
    }
    ctx.stroke();
  };

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(232,230,225,0.035)";
  lines("minor");
  ctx.strokeStyle = "rgba(232,230,225,0.08)";
  lines("major");
  if (flat) {
    ctx.strokeStyle = "rgba(134,168,255,0.35)";
    lines("axis");
  } else {
    // in 3D, draw all three axes through the origin, each in its own colour
    const L = (Math.min(width, height) / 2 / k) * 0.85;
    ctx.font = "500 11px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const a of AXES) {
      const [vx, vy, vz] = a.v;
      const end = rot(vx * L, vy * L, vz * L);
      const ex = cx + end.X * k, ey = cy - end.Y * k;
      const neg = rot(-vx * L, -vy * L, -vz * L);
      const nx = cx + neg.X * k, ny = cy - neg.Y * k;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(${a.color},0.55)`;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${a.color},0.25)`;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(${a.color},0.9)`;
      ctx.fillText(a.name, ex + (ex - cx) * 0.04, ey + (ey - cy) * 0.04);
    }
  }

  if (flat) {
    ctx.fillStyle = "rgba(141,139,134,0.75)";
    ctx.font = "10px 'IBM Plex Mono', monospace";
    const fmt = (v: number) => +v.toPrecision(6) + "";
    const ax = Math.min(height - 14, Math.max(12, cy)); // keep labels on screen
    const ay = Math.min(width - 30, Math.max(4, cx));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let v = Math.ceil((wx - reach) / major) * major; v <= wx + reach; v += major) {
      if (Math.abs(v) < step / 2) continue;
      ctx.fillText(fmt(v), cx + v * k, ax + 4);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let v = Math.ceil((wy - reach) / major) * major; v <= wy + reach; v += major) {
      if (Math.abs(v) < step / 2) continue;
      ctx.fillText(fmt(v), ay + 5, cy - v * k);
    }
  }
  ctx.restore();
}

/**
 * The drawn point (dot or path vertex) nearest a screen position, within
 * maxPx. Returns its world coordinates and where it sits on screen.
 */
export function nearestPoint(width: number, height: number, frame: Frame, cam: Camera, mx: number, my: number, maxPx = 14) {
  const b = frame.buf;
  const k = scaleOf(width, height, frame, cam);
  const cx = width / 2 + cam.ox, cy = height / 2 + cam.oy;
  const rot = rotator(cam);
  let best = maxPx * maxPx;
  let hit: { x: number; y: number; z: number; sx: number; sy: number } | null = null;
  for (let i = 0; i < b.length; ) {
    const op = b[i];
    if (op === OP.DOT || op === OP.MOVE || op === OP.LINE) {
      const p = rot(b[i + 1], b[i + 2], b[i + 3]);
      const sx = cx + p.X * k, sy = cy - p.Y * k;
      const d = (sx - mx) ** 2 + (sy - my) ** 2;
      if (d < best) {
        best = d;
        hit = { x: b[i + 1], y: b[i + 2], z: b[i + 3], sx, sy };
      }
      i += 4;
    } else if (op === OP.COLOR) i += 5;
    else if (op === OP.SIZE || op === OP.WIDTH) i += 2;
    else i += 1;
  }
  return hit;
}

/** True if anything in the frame leaves the z = 0 plane. */
export function hasDepth(frame: Frame) {
  const b = frame.buf;
  for (let i = 0; i < b.length; ) {
    const op = b[i];
    if (op === OP.DOT || op === OP.MOVE || op === OP.LINE) {
      if (b[i + 3] !== 0) return true;
      i += 4;
    } else if (op === OP.COLOR) i += 5;
    else if (op === OP.SIZE || op === OP.WIDTH) i += 2;
    else i += 1;
  }
  return false;
}
