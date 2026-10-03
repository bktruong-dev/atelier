/** The user's own saved patterns, kept in this browser only. */
export interface Saved {
  id: string;
  name: string;
  code: string;
  values: Record<string, number>;
  updated: number;
}

const KEY = "atelier.library.v1";

export function list(): Saved[] {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(data)) return [];
    return data
      .filter((s) => s && typeof s.id === "string" && typeof s.name === "string" && typeof s.code === "string")
      .sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
  } catch {
    return [];
  }
}

function write(items: Saved[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function upsert(item: Omit<Saved, "id" | "updated"> & { id?: string | null }): Saved | null {
  const saved: Saved = { ...item, id: item.id ?? newId(), updated: Date.now() };
  const items = list().filter((s) => s.id !== saved.id);
  return write([saved, ...items]) ? saved : null;
}

export function remove(id: string) {
  write(list().filter((s) => s.id !== id));
}

export function get(id: string): Saved | undefined {
  return list().find((s) => s.id === id);
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** The pattern being edited, so a reload doesn't lose work. */
const DRAFT = "atelier.draft.v1";

export function saveDraft(d: { name: string; code: string; values: Record<string, number>; savedId: string | null }) {
  try {
    localStorage.setItem(DRAFT, JSON.stringify(d));
  } catch {
    /* storage unavailable: drafts are a convenience */
  }
}

export function loadDraft(): { name: string; code: string; values: Record<string, number>; savedId: string | null } | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT) ?? "null");
    if (d && typeof d.code === "string" && typeof d.name === "string") {
      return { name: d.name, code: d.code, values: numbers(d.values), savedId: typeof d.savedId === "string" ? d.savedId : null };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function numbers(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object") {
    for (const [k, n] of Object.entries(v)) if (typeof n === "number" && Number.isFinite(n) && k.length <= 32) out[k] = n;
  }
  return out;
}
