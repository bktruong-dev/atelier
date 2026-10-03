import type { Camera } from "../render";

/**
 * Drag to pan (or orbit in Orbit mode, or with Shift / right-drag),
 * scroll or pinch to zoom at the cursor, double-click to reset.
 */
export function attachCamera(
  canvas: HTMLCanvasElement,
  cam: Camera,
  opts: { orbit: () => boolean; onChange: () => void; onReset: () => void },
) {
  const pointers = new Map<number, { x: number; y: number }>();
  let rotating = false;

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

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rotating = opts.orbit() || e.shiftKey || e.button === 2;
    canvas.classList.add("dragging");
  });

  canvas.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;

    if (pointers.size === 2) {
      // pinch: zoom by the change in finger distance, pan by the midpoint
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
      cam.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cam.pitch + dy * 0.01));
    } else {
      cam.ox += dx;
      cam.oy += dy;
    }
    prev.x = e.clientX;
    prev.y = e.clientY;
    opts.onChange();
  });

  const end = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) canvas.classList.remove("dragging");
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
      zoomAt(Math.exp(-delta * 0.0015), p.x, p.y, p.w, p.h);
      opts.onChange();
    },
    { passive: false },
  );
}
