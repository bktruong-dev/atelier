/** Viewer preferences, kept in this browser. */
export type Quality = "high" | "balanced" | "fast";
export type Accent = "blue" | "gold" | "rose" | "mint" | "violet";

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
