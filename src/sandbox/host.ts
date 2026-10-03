import { DEFAULT_DURATION, DEFAULT_VIEW } from "./ops";

export interface FrameResult {
  buf: Float32Array;
  duration: number;
  view: number;
  error: { message: string; line: number | null } | null;
}

/** One frame may take this long before the worker is assumed stuck and killed. */
const TIME_LIMIT_MS = 2000;

/**
 * Talks to the pattern worker. Only one frame is in flight at a time; newer
 * requests replace older queued ones. Replies are checked before use, since
 * pattern code runs in the worker.
 */
export class Sandbox {
  private worker!: Worker;
  private code = "";
  private names: string[] = [];
  private codeChanged = true;
  private nextId = 0;
  private pending: { id: number; timer: number } | null = null;
  private queued: { t: number; T: number; values: Record<string, number> } | null = null;
  /** Set after a timeout; cleared when the code changes. */
  halted = false;

  constructor(
    private onFrame: (f: FrameResult) => void,
    private onTimeout: () => void,
  ) {
    this.spawn();
  }

  /** The code and the dial names it can use; either changing means a recompile. */
  setCode(code: string, names: string[]) {
    if (code === this.code && names.join() === this.names.join() && !this.halted) return;
    this.code = code;
    this.names = [...names];
    this.codeChanged = true;
    this.halted = false;
  }

  request(t: number, T: number, values: Record<string, number>) {
    if (this.halted) return;
    const req = { t, T, values: { ...values } };
    if (this.pending) this.queued = req;
    else this.send(req);
  }

  private spawn() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", (e) => this.receive(e.data));
    this.codeChanged = true;
  }

  private send(req: { t: number; T: number; values: Record<string, number> }) {
    const id = ++this.nextId;
    const msg = { kind: "frame", id, ...req, code: this.codeChanged ? this.code : undefined, names: this.names };
    this.codeChanged = false;
    this.pending = { id, timer: window.setTimeout(() => this.timeout(), TIME_LIMIT_MS) };
    this.worker.postMessage(msg);
  }

  private timeout() {
    this.worker.terminate();
    this.pending = null;
    this.queued = null;
    this.halted = true;
    this.spawn();
    this.onTimeout();
  }

  private receive(d: unknown) {
    const r = d as Record<string, unknown> | null;
    if (!r || r.kind !== "frame" || !this.pending || r.id !== this.pending.id) return;
    clearTimeout(this.pending.timer);
    this.pending = null;

    const result = clean(r);
    if (this.queued) {
      const q = this.queued;
      this.queued = null;
      this.send(q);
    }
    if (result) this.onFrame(result);
  }
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function clean(r: Record<string, unknown>): FrameResult | null {
  const buf = r.buf instanceof Float32Array ? r.buf : new Float32Array(0);
  let error: FrameResult["error"] = null;
  const e = r.error as Record<string, unknown> | null;
  if (e && typeof e === "object") {
    error = {
      message: String(e.message ?? "Error").slice(0, 500),
      line: isNum(e.line) ? Math.floor(e.line) : null,
    };
  }
  return {
    buf,
    duration: isNum(r.duration) && r.duration > 0 ? r.duration : DEFAULT_DURATION,
    view: isNum(r.view) && r.view > 0 ? r.view : DEFAULT_VIEW,
    error,
  };
}
