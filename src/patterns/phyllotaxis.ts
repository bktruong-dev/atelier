import { ACCENT, INK, type Pattern } from "./types";

const GOLDEN_ANGLE = 180 * (3 - Math.sqrt(5)); // 137.5077…°

export const phyllotaxis: Pattern = {
  id: "phyllotaxis",
  name: "Phyllotaxis",
  duration: 20,
  params: [
    { key: "angle", label: "Divergence angle", min: 130, max: 145, step: 0.001, value: +GOLDEN_ANGLE.toFixed(3) },
    { key: "seeds", label: "Seeds", min: 100, max: 4000, step: 1, value: 1500 },
    { key: "size", label: "Seed size", min: 0.5, max: 4, step: 0.1, value: 1.8 },
  ],

  formula(p, t) {
    const n = seedsAt(p.seeds, t, this.duration);
    return [
      `θₙ = n · ${p.angle.toFixed(3)}°`,
      `rₙ = c · √n`,
      `n  = 0 … ${n.toLocaleString("en-US")}`,
      ``,
      `golden angle = 360° / φ² ≈ ${GOLDEN_ANGLE.toFixed(3)}°`,
    ].join("\n");
  },

  draw(ctx, t, p, view) {
    const n = seedsAt(p.seeds, t, this.duration);
    const cx = view.width / 2;
    const cy = view.height / 2;
    // Scale so the full pattern (all seeds) just fits, so it grows into place.
    const c = (Math.min(view.width, view.height) * 0.46) / Math.sqrt(p.seeds);
    const step = (p.angle * Math.PI) / 180;
    const r0 = p.size * (view.light ? 0.8 : 1);

    ctx.fillStyle = INK;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const r = c * Math.sqrt(i);
      const a = i * step;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      ctx.moveTo(x + r0, y);
      ctx.arc(x, y, r0, 0, Math.PI * 2);
    }
    ctx.fill();

    // The newest seed, in the accent colour.
    if (n > 0) {
      const i = n - 1;
      const r = c * Math.sqrt(i);
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(cx + r * Math.cos(i * step), cy + r * Math.sin(i * step), r0 * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

function seedsAt(total: number, t: number, duration: number): number {
  return Math.floor(total * Math.min(1, Math.max(0, t / duration)));
}
