import type { Camera } from "../render";

/**
 * Drag to pan (or orbit in Orbit mode, or with Shift / right-drag),
 * scroll or pinch to zoom at the cursor, double-click to reset.
 *
 * With smoothing on, wheel zoom eases in and a drag keeps gliding after you
 * let go. step(dt) advances that motion once per frame.
 */
export function attachCamera(
  canvas: HTMLCanvasElement,
  cam: Camera,
  opts: { orbit: () => boolean; smooth: () => boolean; onChange: () => void; onReset: () => void },
) {
  const pointers = new Map<number, { x: number; y: number }>();
  let rotating = false;
  let lastMove = 0;
  // glide after release: px/s for pan, rad/s for rotation
  const vel = { x: 0, y: 0, yaw: 0, pitch: 0 };
  // zoom still to apply (log scale) and where it is anchored
  const zoom = { pending: 0, mx: 0, my: 0, w: 1, h: 1 };

  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  };

  /** Scale by f, keeping the point under (mx, my) still. */
  const zoomAt = (f: number, mx: number, my: number, w: number, h: number) => {
    const next = Math.min(1e5, Math.max(1e-4, cam.zoom * f));
    f = next / cam.zoom;
    const ax = mx - w / 2, ay = my - h / 2;
    cam.ox = ax - (ax - cam.ox) * f;
    cam.oy = ay - (ay - cam.oy) * f;
    cam.zoom = next;
  };

  const clampPitch = () => (cam.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cam.pitch)));

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rotating = opts.orbit() || e.shiftKey || e.button === 2;
    vel.x = vel.y = vel.yaw = vel.pitch = 0;
    lastMove = performance.now();
    canvas.classList.add("dragging");
  });

  canvas.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    const now = performance.now();
    const dt = Math.max(1, now - lastMove) / 1000;
    lastMove = now;
    // velocity for the glide, smoothed so one jittery event doesn't fling it
    const blend = (v: number, target: number) => v * 0.6 + target * 0.4;

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const other = a === prev ? b : a;
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const m = local({ clientX: (e.clientX + other.x) / 2, clientY: (e.clientY + other.y) / 2 });
      if (before > 0) zoomAt(after / before, m.x, m.y, m.w, m.h);
      cam.ox += dx / 2;
      cam.oy += dy / 2;
    } else if (rotating) {
      cam.yaw += dx * 0.01;
      cam.pitch += dy * 0.01;
      clampPitch();
      vel.yaw = blend(vel.yaw, (dx * 0.01) / dt);
      vel.pitch = blend(vel.pitch, (dy * 0.01) / dt);
    } else {
      cam.ox += dx;
      cam.oy += dy;
      vel.x = blend(vel.x, dx / dt);
      vel.y = blend(vel.y, dy / dt);
    }
    prev.x = e.clientX;
    prev.y = e.clientY;
    opts.onChange();
  });

  const end = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) canvas.classList.remove("dragging");
    // a pause before letting go means no glide
    if (performance.now() - lastMove > 80 || !opts.smooth()) vel.x = vel.y = vel.yaw = vel.pitch = 0;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("dblclick", () => opts.onReset());

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const p = local(e);
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const amount = -delta * 0.0015;
      if (opts.smooth()) {
        zoom.pending += amount;
        Object.assign(zoom, { mx: p.x, my: p.y, w: p.w, h: p.h });
      } else {
        zoomAt(Math.exp(amount), p.x, p.y, p.w, p.h);
        opts.onChange();
      }
    },
    { passive: false },
  );

  return {
    /** Advance glide and eased zoom. Returns true if the camera moved. */
    step(dt: number): boolean {
      let moved = false;
      if (Math.abs(zoom.pending) > 1e-4) {
        const part = zoom.pending * (1 - Math.exp(-dt * 16));
        zoom.pending -= part;
        zoomAt(Math.exp(part), zoom.mx, zoom.my, zoom.w, zoom.h);
        moved = true;
      } else zoom.pending = 0;

      if (pointers.size === 0) {
        const decay = Math.exp(-dt * 5);
        if (Math.abs(vel.x) + Math.abs(vel.y) > 2) {
          cam.ox += vel.x * dt;
          cam.oy += vel.y * dt;
          vel.x *= decay;
          vel.y *= decay;
          moved = true;
        } else vel.x = vel.y = 0;
        if (Math.abs(vel.yaw) + Math.abs(vel.pitch) > 0.01) {
          cam.yaw += vel.yaw * dt;
          cam.pitch += vel.pitch * dt;
          clampPitch();
          vel.yaw *= decay;
          vel.pitch *= decay;
          moved = true;
        } else vel.yaw = vel.pitch = 0;
      }
      return moved;
    },
    /** Stop any glide or pending zoom (when the view is reset or a page opens). */
    stop() {
      vel.x = vel.y = vel.yaw = vel.pitch = 0;
      zoom.pending = 0;
    },
    dragging: () => pointers.size > 0,
  };
}
