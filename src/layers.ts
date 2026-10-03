import type { Layer, Page } from "./notebook";
import { Sandbox } from "./sandbox/host";

type DialRequest = { name: string; value: number; min: number; max: number; step: number };

interface Runner {
  sandbox: Sandbox;
  pageId: string;
  buf: Float32Array | null;
  duration: number;
  lastKey: string;
}

/**
 * Runs the pages overlaid on the current page. Each layer has its own sandbox
 * worker, so layers can't see or slow each other, and is asked for a new
 * frame only when its time, code or dials change.
 */
export class LayerSet {
  private runners = new Map<string, Runner>();

  constructor(
    private onUpdate: () => void,
    private onDialRequests: (pageId: string, requests: DialRequest[]) => void,
  ) {}

  /** Keep exactly one runner per layer in this list. */
  sync(layers: Layer[]) {
    const keep = new Set(layers.map((l) => l.id));
    for (const [id, r] of this.runners) {
      if (!keep.has(id)) {
        r.sandbox.dispose();
        this.runners.delete(id);
      }
    }
    for (const l of layers) {
      const existing = this.runners.get(l.id);
      if (existing && existing.pageId !== l.pageId) {
        existing.sandbox.dispose();
        this.runners.delete(l.id);
      }
      if (!this.runners.has(l.id)) this.runners.set(l.id, this.spawn(l));
    }
  }

  private spawn(l: Layer): Runner {
    const runner: Runner = {
      pageId: l.pageId,
      buf: null,
      duration: 10,
      lastKey: "",
      sandbox: new Sandbox(
        (r) => {
          if (r.dialRequests.length) this.onDialRequests(runner.pageId, r.dialRequests);
          if (r.error) return;
          runner.buf = r.buf;
          runner.duration = r.duration;
          this.onUpdate();
        },
        () => {
          runner.buf = null; // a stuck layer just disappears
          this.onUpdate();
        },
      ),
    };
    return runner;
  }

  /** Ask each visible layer for the frame at its own time. */
  tick(layers: Layer[], find: (id: string) => Page | undefined, mainT: number, dialValue: (name: string) => number | undefined) {
    for (const l of layers) {
      const r = this.runners.get(l.id);
      const p = find(l.pageId);
      if (!r || !p || !l.visible) continue;
      const t = l.time === "main" ? mainT : dialValue(l.time) ?? mainT;
      const names = p.dials.map((d) => d.name);
      const values = Object.fromEntries(p.dials.map((d) => [d.name, d.kind === "color" ? d.color ?? "#86a8ff" : d.value]));
      const key = `${t}|${p.code.length}|${p.code.slice(-64)}|${JSON.stringify(values)}`;
      if (key === r.lastKey) continue;
      r.lastKey = key;
      r.sandbox.setCode(p.code, names);
      r.sandbox.request(t, r.duration, values);
    }
  }

  frames(layers: Layer[]) {
    return layers.flatMap((l) => {
      const buf = l.visible ? this.runners.get(l.id)?.buf : null;
      return buf ? [{ buf, opacity: l.opacity }] : [];
    });
  }
}
