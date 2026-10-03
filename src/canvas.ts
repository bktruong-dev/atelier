export interface View {
  width: number; // CSS pixels
  height: number;
  light: boolean; // phones: lower resolution
}

/** Keeps the canvas backing store matched to its CSS size × devicePixelRatio. */
export function setupCanvas(canvas: HTMLCanvasElement, onResize: () => void) {
  const ctx = canvas.getContext("2d")!;
  const light = matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  const view: View = { width: 0, height: 0, light };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2);
    view.width = rect.width;
    view.height = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize();
  };

  new ResizeObserver(resize).observe(canvas);
  return { ctx, view };
}
