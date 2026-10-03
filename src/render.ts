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

export function drawFrame(ctx: CanvasRenderingContext2D, width: number, height: number, frame: Frame, cam: Camera) {
  ctx.clearRect(0, 0, width, height);
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
