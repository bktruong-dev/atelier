import { badDialName } from "./sandbox/ops";

/**
 * The notebook: the user's pages, kept in this browser. Each page has its
 * code and its dials. Dials are variables the code can use by name.
 */
export type DialMode = "loop" | "bounce" | "once";

export interface Dial {
  name: string;
  /** A number slider (default) or a colour, which the code gets as "#rrggbb". */
  kind?: "number" | "color";
  color?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Units per second while playing. */
  rate: number;
  mode: DialMode;
  playing: boolean;
  dir: 1 | -1;
}

export interface Page {
  id: string;
  name: string;
  code: string;
  dials: Dial[];
  updated: number;
}

const KEY = "atelier.notebook.v1";

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function makeDial(name: string, value = 1, min = 0, max = 10, step = 0.01): Dial {
  return { name, value, min, max, step, rate: (max - min) / 10, mode: "bounce", playing: false, dir: 1 };
}

export function makeColorDial(name: string, color = "#86a8ff"): Dial {
  return { ...makeDial(name, 0, 0, 1, 1), kind: "color", color };
}

const HEX = /^#[0-9a-f]{6}$/i;

export function loadNotebook(): { pages: Page[]; active: string | null } {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (d && Array.isArray(d.pages)) {
      const pages = d.pages.map(cleanPage).filter((p: Page | null): p is Page => !!p);
      return { pages, active: typeof d.active === "string" ? d.active : null };
    }
  } catch {
    /* fall through to an empty notebook */
  }
  return { pages: [], active: null };
}

export function saveNotebook(pages: Page[], active: string | null): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ pages, active }));
    return true;
  } catch {
    return false;
  }
}

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Check a dial from storage or a share link; anything odd is dropped or repaired. */
export function cleanDial(d: unknown): Dial | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (typeof o.name !== "string" || badDialName(o.name)) return null;
  let min = num(o.min, 0), max = num(o.max, 10);
  if (min > max) [min, max] = [max, min];
  if (min === max) max = min + 1;
  const step = num(o.step, 0.01) > 0 ? num(o.step, 0.01) : 0.01;
  const mode: DialMode = o.mode === "loop" || o.mode === "once" ? o.mode : "bounce";
  if (o.kind === "color") {
    return { ...makeColorDial(o.name, typeof o.color === "string" && HEX.test(o.color) ? o.color.toLowerCase() : "#86a8ff") };
  }
  return {
    name: o.name,
    value: Math.min(max, Math.max(min, num(o.value, min))),
    min,
    max,
    step,
    rate: Math.abs(num(o.rate, (max - min) / 10)),
    mode,
    playing: o.playing === true,
    dir: o.dir === -1 ? -1 : 1,
  };
}

export function cleanDials(list: unknown): Dial[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: Dial[] = [];
  for (const d of list.slice(0, 32)) {
    const c = cleanDial(d);
    if (c && !seen.has(c.name)) {
      seen.add(c.name);
      out.push(c);
    }
  }
  return out;
}

function cleanPage(p: unknown): Page | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.code !== "string") return null;
  return {
    id: o.id,
    name: typeof o.name === "string" ? o.name.slice(0, 80) : "Untitled",
    code: o.code,
    dials: cleanDials(o.dials),
    updated: num(o.updated, 0),
  };
}
