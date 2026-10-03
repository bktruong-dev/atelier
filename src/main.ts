import "./style.css";
import { setupCanvas } from "./canvas";
import { Clock } from "./clock";
import * as library from "./library";
import { BLANK, EXAMPLES } from "./presets";
import { drawFrame, fitCamera, newCamera, type Frame } from "./render";
import { DEFAULT_DURATION, type Decl } from "./sandbox/ops";
import { Sandbox, type FrameResult } from "./sandbox/host";
import { decodeShare, encodeShare } from "./share";
import { attachCamera } from "./ui/camera";
import { dialSignature, renderDials } from "./ui/dials";
import { createEditor } from "./ui/editor";
import { createTimeline } from "./ui/timeline";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("canvas");
const caption = $("caption");
const nameInput = $<HTMLInputElement>("name");
const errorBox = $<HTMLButtonElement>("error");
const mine = $<HTMLSelectElement>("mine");
const deleteButton = $<HTMLButtonElement>("delete");
const orbitButton = $<HTMLButtonElement>("orbit");
const examplesNav = $("examples");

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// ---- state ---------------------------------------------------------------

const state = {
  name: "",
  code: "",
  values: {} as Record<string, number>,
  savedId: null as string | null,
  example: -1,
};
let frame: Frame | null = null;
let decls: Decl[] = [];
let dialsKey = "";
let needsFrame = true;
let needsDraw = true;
let orbit = false;

const clock = new Clock(DEFAULT_DURATION);
const cam = newCamera();
const { ctx, view } = setupCanvas(canvas, () => (needsDraw = true));
const sandbox = new Sandbox(onFrame, onTimeout);

const editor = createEditor($<HTMLTextAreaElement>("code"), {
  onChange(code) {
    state.code = code;
    sandbox.setCode(code);
    needsFrame = true;
    persist();
  },
  onRun() {
    if (!clock.playing && clock.t >= clock.duration) clock.play(1);
  },
});

const syncTimeline = createTimeline($("timeline"), clock, () => (needsFrame = true));

attachCamera(canvas, cam, {
  orbit: () => orbit,
  onChange: () => (needsDraw = true),
  onReset: resetView,
});

// ---- loading patterns ----------------------------------------------------

function load(p: { name: string; code: string; values?: Record<string, number> }, opts: { example?: number; savedId?: string | null; play?: boolean } = {}) {
  state.name = p.name;
  state.code = p.code;
  state.values = { ...(p.values ?? {}) };
  state.example = opts.example ?? -1;
  state.savedId = opts.savedId ?? null;
  nameInput.value = p.name;
  editor.set(p.code);
  sandbox.setCode(p.code);
  frame = null;
  dialsKey = "";
  Object.assign(cam, newCamera());
  clock.reset();
  if (opts.play !== false) clock.play(1);
  needsFrame = true;
  showError(null);
  refreshChrome();
  persist();
}

function refreshChrome() {
  const fig = state.example >= 0 ? ROMAN[state.example] : "∗";
  caption.textContent = `Fig. ${fig} — ${state.name || "Untitled"}`;
  for (const b of examplesNav.querySelectorAll<HTMLButtonElement>("button")) {
    b.setAttribute("aria-pressed", String(Number(b.dataset.index) === state.example));
  }
  deleteButton.hidden = !state.savedId;
  fillMine();
}

function fillMine() {
  const items = library.list();
  const head = new Option(items.length ? "My patterns" : "My patterns (none saved)", "");
  mine.replaceChildren(head, ...items.map((s) => new Option(s.name || "Untitled", s.id)));
  mine.value = state.savedId && items.some((s) => s.id === state.savedId) ? state.savedId : "";
}

function persist() {
  library.saveDraft({ name: state.name, code: state.code, values: state.values, savedId: state.savedId });
}

// ---- sandbox replies -----------------------------------------------------

function onFrame(r: FrameResult) {
  if (r.error) {
    showError(r.error);
    return; // keep the last good picture
  }
  showError(null);
  frame = { buf: r.buf, view: r.view };

  const key = dialSignature(r.decls);
  decls = r.decls;
  if (key !== dialsKey) {
    dialsKey = key;
    renderDials($("dials"), decls, (name, value) => {
      state.values[name] = value;
      needsFrame = true;
      persist();
    });
  }

  if (r.duration !== clock.duration) {
    clock.duration = r.duration;
    clock.seek(clock.t);
    needsFrame = true;
  }
  needsDraw = true;
}

function onTimeout() {
  clock.pause();
  showError({
    message: "This frame took longer than 2 seconds, so the pattern was stopped. Look for a loop that never ends; editing the code runs it again.",
    line: null,
  });
}

let errorLine: number | null = null;
function showError(e: FrameResult["error"]) {
  errorBox.hidden = !e;
  errorLine = e?.line ?? null;
  errorBox.textContent = e ? (e.line ? `Line ${e.line} · ${e.message}` : e.message) : "";
  errorBox.disabled = !errorLine;
}
errorBox.addEventListener("click", () => errorLine && editor.goToLine(errorLine));

// ---- toolbar -------------------------------------------------------------

EXAMPLES.forEach((ex, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = ex.name;
  b.dataset.index = String(i);
  b.addEventListener("click", () => load(ex, { example: i }));
  examplesNav.append(b);
});

$("new").addEventListener("click", () => load(BLANK));

$("save").addEventListener("click", () => {
  const name = nameInput.value.trim() || "Untitled";
  const saved = library.upsert({ id: state.savedId, name, code: state.code, values: state.values });
  if (!saved) return toast("Couldn't save: this browser has storage turned off.");
  state.savedId = saved.id;
  state.name = name;
  state.example = -1;
  refreshChrome();
  persist();
  toast(`Saved “${name}” in this browser`);
});

deleteButton.addEventListener("click", () => {
  if (!state.savedId || !confirm(`Delete “${state.name}” from your patterns?`)) return;
  library.remove(state.savedId);
  state.savedId = null;
  refreshChrome();
  persist();
  toast("Deleted");
});

mine.addEventListener("change", () => {
  const s = mine.value && library.get(mine.value);
  if (s) load(s, { savedId: s.id });
});

nameInput.addEventListener("input", () => {
  state.name = nameInput.value;
  const fig = state.example >= 0 ? ROMAN[state.example] : "∗";
  caption.textContent = `Fig. ${fig} — ${state.name || "Untitled"}`;
  persist();
});

$("share").addEventListener("click", async () => {
  const data = await encodeShare({ name: state.name, code: state.code, values: state.values });
  const url = `${location.origin}${location.pathname}#p=${data}`;
  history.replaceState(null, "", `#p=${data}`);
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied. It contains the code and dial settings.");
  } catch {
    toast("Link is in the address bar. Copy it from there.");
  }
});

$("png").addEventListener("click", () => {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const c = out.getContext("2d")!;
  c.fillStyle = "#0c0d10";
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(canvas, 0, 0);
  out.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(state.name || "pattern").replace(/[^\w-]+/g, "-").toLowerCase()}-t${clock.t.toFixed(1)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
});

$("add-dial").addEventListener("click", () => {
  const taken = new Set(decls.map((d) => d.name));
  const name = "abckmnuvwxyz".split("").find((c) => !taken.has(c)) ?? `k${decls.length}`;
  editor.insertLine(`const ${name} = dial("${name}", 1, 0, 10);`);
  toast(`Added dial “${name}”. Use ${name} in your code.`);
});

orbitButton.addEventListener("click", () => {
  orbit = !orbit;
  orbitButton.setAttribute("aria-pressed", String(orbit));
});

$("fit").addEventListener("click", () => {
  if (frame) fitCamera(view.width, view.height, frame, cam);
  needsDraw = true;
});
$("reset-view").addEventListener("click", resetView);

function resetView() {
  Object.assign(cam, newCamera());
  needsDraw = true;
}

let toastTimer = 0;
function toast(msg: string) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 2600);
}

// ---- frame loop ----------------------------------------------------------

let last = performance.now();
let lastT = -1;
function tick(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); // no big jump after a background tab
  last = now;
  clock.tick(dt);

  if (clock.t !== lastT) needsFrame = true;
  if (needsFrame) {
    sandbox.request(clock.t, clock.duration, state.values);
    lastT = clock.t;
    needsFrame = false;
  }
  if (needsDraw && frame) {
    drawFrame(ctx, view.width, view.height, frame, cam);
    needsDraw = false;
  }
  syncTimeline();
  requestAnimationFrame(tick);
}

// ---- start ---------------------------------------------------------------

async function start() {
  const hash = /^#p=([\w-]+)$/.exec(location.hash);
  const shared = hash && (await decodeShare(hash[1]));
  if (shared) {
    load(shared);
    history.replaceState(null, "", location.pathname); // edits now go to the draft, not back to the link
    toast("Opened a shared pattern. Its code runs in a sandbox.");
  } else {
    const draft = library.loadDraft();
    if (draft) load(draft, { savedId: draft.savedId, example: EXAMPLES.findIndex((e) => e.code === draft.code) });
    else load(EXAMPLES[0], { example: 0 });
  }
  requestAnimationFrame(tick);
}

start();
