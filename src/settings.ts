/** Viewer preferences, kept in this browser. */
export type Quality = "high" | "balanced" | "fast";
export type Accent = "blue" | "gold" | "rose" | "mint" | "violet";
export type Background = "dots" | "plain" | "black" | "image";

export interface Settings {
  grid: boolean;
  glow: boolean;
  /** Hover a point to read its x, y, z. */
  inspect: boolean;
  /** Cursor x, y in the corner (flat view). */
  coords: boolean;
  /** Eased zoom and gliding drags. */
  smooth: boolean;
  quality: Quality;
  /** Degrees per second the camera turns in cinema mode (3D patterns). */
  spin: number;
  /** The quote on arrival. */
  intro: boolean;
  accent: Accent;
  /** Frames per second and draw time, in the corner of the canvas. */
  fps: boolean;
  /** Behind the pattern: dot grid, plain ink, pure black, or your own image. */
  background: Background;
  /** How much to darken a background image so patterns stay readable (0–0.9). */
  bgDim: number;
}

export const DEFAULTS: Settings = {
  grid: true,
  glow: true,
  inspect: true,
  coords: true,
  smooth: true,
  quality: "balanced",
  spin: 8,
  intro: true,
  accent: "blue",
  fps: false,
  background: "dots",
  bgDim: 0.45,
};

export const ACCENTS: Record<Accent, string> = {
  blue: "#86a8ff",
  gold: "#d9b878",
  rose: "#f2a6c4",
  mint: "#8fd3a8",
  violet: "#b79cff",
};

/** Largest devicePixelRatio the canvas renders at. */
export const DPR_CAP: Record<Quality, number> = { high: 3, balanced: 2, fast: 1 };

const KEY = "atelier.settings.v1";

export function loadSettings(): Settings {
  const s = { ...DEFAULTS };
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) {
      if (typeof d[k] === typeof DEFAULTS[k]) (s as Record<string, unknown>)[k] = d[k];
    }
    if (!(s.quality in DPR_CAP)) s.quality = DEFAULTS.quality;
    if (!(s.accent in ACCENTS)) s.accent = DEFAULTS.accent;
    if (!["dots", "plain", "black", "image"].includes(s.background)) s.background = DEFAULTS.background;
    s.bgDim = Math.min(0.9, Math.max(0, s.bgDim));
  } catch {
    /* defaults */
  }
  return s;
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* settings are a convenience */
  }
}

/** Point the UI's accent colour at the chosen theme. */
export function applyAccent(a: Accent) {
  const hex = ACCENTS[a];
  const n = parseInt(hex.slice(1), 16);
  const rgb = `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`;
  const root = document.documentElement.style;
  root.setProperty("--accent", hex);
  root.setProperty("--accent-rgb", rgb);
  root.setProperty("--accent-soft", `rgba(${rgb}, 0.14)`);
}

// ---- background image: kept separately, since it can be a few hundred KB

const BG_KEY = "atelier.background.v1";

export function loadBackgroundImage(): string | null {
  try {
    const d = localStorage.getItem(BG_KEY);
    return d && /^data:image\/(jpeg|png|webp);base64,/.test(d) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Shrink a picked image to at most 1920px on its long side and store it as a
 * JPEG, so it fits comfortably in browser storage. Returns the stored data URL.
 */
export async function storeBackgroundImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) throw new Error("That file isn't an image Atelier can use.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * scale);
  c.height = Math.round(bitmap.height * scale);
  c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close();
  const url = c.toDataURL("image/jpeg", 0.85);
  try {
    localStorage.setItem(BG_KEY, url);
  } catch {
    throw new Error("That image is too big to keep in this browser. Try a smaller one.");
  }
  return url;
}

export function clearBackgroundImage() {
  try {
    localStorage.removeItem(BG_KEY);
  } catch {
    /* ignore */
  }
}

/** Show the chosen background behind the canvas and the page. */
export function applyBackground(s: Settings, image: string | null) {
  const body = document.body;
  const mode = s.background === "image" && !image ? "dots" : s.background;
  for (const m of ["dots", "plain", "black", "image"]) body.classList.toggle(`bg-${m}`, m === mode);
  const plate = document.querySelector<HTMLElement>(".plate");
  if (!plate) return;
  if (mode === "image" && image) {
    // the image is set through the CSSOM, which the page's security policy allows
    plate.style.setProperty("--bg-image", `url("${image}")`);
    plate.style.setProperty("--bg-dim", String(s.bgDim));
  } else {
    plate.style.removeProperty("--bg-image");
  }
}
