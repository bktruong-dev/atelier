import "./style.css";
import { setupCanvas } from "./canvas";
import { Clock } from "./clock";
import { loadNotebook, makeDial, newId, saveNotebook, type Dial, type Page } from "./notebook";
import { BLANK, REFERENCE, type Template } from "./presets";
import { drawFrame, fitCamera, newCamera, scaleOf, type Frame } from "./render";
import { DEFAULT_DURATION } from "./sandbox/ops";
import { Sandbox, type FrameResult } from "./sandbox/host";
import { decodeShare, encodeShare } from "./share";
import { attachCamera } from "./ui/camera";
import { renderDials } from "./ui/dials";
import { createEditor } from "./ui/editor";
import { createTimeline } from "./ui/timeline";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("canvas");
const caption = $("caption");
const nameInput = $<HTMLInputElement>("name");
const errorBox = $<HTMLButtonElement>("error");
const tabs = $("tabs");

const REF_ID = "ref";
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];

const fromTemplate = (t: Template, id: string): Page => ({
  id,
  name: t.name,
  code: t.code,
  dials: t.dials.map((d) => ({ ...d })),
  updated: Date.now(),
});

// ---- state ---------------------------------------------------------------

const stored = loadNotebook();
const pages: Page[] = stored.pages;
/** The reference page lives in memory only; edits to it are for play. */
const refPage = fromTemplate(REFERENCE, REF_ID);
let page: Page = refPage;

let frame: Frame | null = null;
let needsFrame = true;
let needsDraw = true;
let orbit = false;
let grid = true;
let syncDials = () => {};

const clock = new Clock(DEFAULT_DURATION);
const cam = newCamera();
const { ctx, view } = setupCanvas(canvas, () => (needsDraw = true));
const sandbox = new Sandbox(onFrame, onTimeout);

const editor = createEditor($<HTMLTextAreaElement>("code"), $("code-mirror"), $("gutter"), {
  onChange(code) {
    page.code = code;
    recompile();
    touch();
  },
  onRun() {
    if (!clock.playing && clock.t >= clock.duration) clock.play(1);
  },
  dialNames: () => page.dials.map((d) => d.name),
});

const syncTimeline = createTimeline($("timeline"), clock, () => (needsFrame = true));

attachCamera(canvas, cam, {
  orbit: () => orbit,
  onChange: () => (needsDraw = true),
  onReset: resetView,
});

const dialValues = () => Object.fromEntries(page.dials.map((d) => [d.name, d.value]));

function recompile() {
  sandbox.setCode(page.code, page.dials.map((d) => d.name));
  needsFrame = true;
}

// ---- pages ---------------------------------------------------------------

function open(id: string) {
  page = id === REF_ID ? refPage : pages.find((p) => p.id === id) ?? refPage;
  nameInput.value = page.name;
  nameInput.readOnly = page === refPage;
  editor.set(page.code);
  frame = null;
  Object.assign(cam, newCamera());
  clock.reset();
  clock.play(1);
  showError(null);
  rebuildDials();
  recompile();
  renderTabs();
  save();
}

function addPage(t: Template, name = t.name) {
  const p = fromTemplate(t, newId());
  p.name = name;
  pages.push(p);
  open(p.id);
  return p;
}

function nextUntitled() {
  const names = new Set(pages.map((p) => p.name));
  for (let i = 1; ; i++) if (!names.has(`Page ${i}`)) return `Page ${i}`;
}

function closePage(p: Page) {
  if (!confirm(`Delete the page “${p.name}”? This can't be undone.`)) return;
  const i = pages.indexOf(p);
  pages.splice(i, 1);
  open(pages[Math.min(i, pages.length - 1)]?.id ?? REF_ID);
}

function renderTabs() {
  const all = [refPage, ...pages];
  const items = all.map((p, i) => {
    const tab = document.createElement("div");
    tab.className = "tab" + (p === refPage ? " ref" : "") + (p === page ? " active" : "");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab-open";
    b.setAttribute("aria-current", String(p === page));
    const num = document.createElement("span");
    num.className = "tab-num";
    num.textContent = ROMAN[i] ?? String(i + 1);
    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = p.name || "Untitled";
    b.append(num, label);
    b.title = p === refPage ? "Reference page" : p.name;
    b.addEventListener("click", () => p !== page && open(p.id));
    b.addEventListener("dblclick", () => {
      if (p !== refPage) {
        nameInput.focus();
        nameInput.select();
      }
    });
    tab.append(b);
    if (p !== refPage && p === page) {
      const x = document.createElement("button");
      x.type = "button";
      x.className = "tab-close";
      x.textContent = "×";
      x.setAttribute("aria-label", `Delete page ${p.name}`);
      x.addEventListener("click", () => closePage(p));
      tab.append(x);
    }
    return tab;
  });
  const plus = document.createElement("button");
  plus.type = "button";
  plus.className = "tab-new";
  plus.textContent = "+";
  plus.title = "New page";
  plus.setAttribute("aria-label", "New page");
  plus.addEventListener("click", () => addPage(BLANK, nextUntitled()));
  tabs.replaceChildren(...items, plus);
  // keep the active tab visible by scrolling only the strip (never scrollIntoView, which can move the page)
  const act = tabs.querySelector<HTMLElement>(".tab.active");
  if (act) {
    const left = act.offsetLeft - tabs.offsetLeft;
    if (left < tabs.scrollLeft) tabs.scrollLeft = left;
    else if (left + act.offsetWidth > tabs.scrollLeft + tabs.clientWidth) tabs.scrollLeft = left + act.offsetWidth - tabs.clientWidth + 40;
  }

  const index = all.indexOf(page);
  caption.textContent = `Fig. ${ROMAN[index] ?? index + 1} — ${page.name || "Untitled"}`;
  const dup = $("duplicate");
  dup.textContent = page === refPage ? "Copy to notebook" : "Duplicate";
  dup.classList.toggle("primary", page === refPage);
  $("ref-note").hidden = page !== refPage;
}

let saveTimer = 0;
function touch() {
  if (page !== refPage) page.updated = Date.now();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 400);
}
function save() {
  if (!saveNotebook(pages, page.id)) toast("Couldn't save: this browser has storage turned off.");
}

nameInput.addEventListener("input", () => {
  if (page === refPage) return;
  page.name = nameInput.value;
  renderTabs();
  touch();
});

$("duplicate").addEventListener("click", () => {
  const src = page;
  const copy = addPage(
    { name: src.name, code: src.code, dials: src.dials.map((d) => ({ ...d, playing: false })) },
    src === refPage ? `${src.name} study` : `${src.name} (copy)`,
  );
  toast(`Copied to your notebook as “${copy.name}”`);
});

// ---- dials ---------------------------------------------------------------

function rebuildDials(openName: string | null = null) {
  syncDials = renderDials(
    $("dials"),
    page.dials,
    {
      onValue() {
        needsFrame = true;
        touch();
      },
      onSettings() {
        needsFrame = true;
        touch();
      },
      onRename(d, from) {
        // rename the variable in the code too
        const re = new RegExp(`(?<![\\w$.])${from.replace(/\$/g, "\\$")}(?![\\w$])`, "g");
        page.code = page.code.replace(re, d.name);
        const area = $<HTMLTextAreaElement>("code");
        const scroll = area.scrollTop;
        editor.set(page.code);
        area.scrollTop = scroll;
        rebuildDials(d.name);
        recompile();
        touch();
      },
      onRemove(d) {
        page.dials = page.dials.filter((o) => o !== d);
        rebuildDials();
        recompile();
        editor.highlight();
        touch();
      },
    },
    openName,
  );
}

$("add-dial").addEventListener("click", () => {
  const taken = new Set(page.dials.map((d) => d.name));
  const name = "abcmnpqsuvwxyz".split("").find((c) => !taken.has(c)) ?? `k${page.dials.length}`;
  page.dials.push(makeDial(name));
  rebuildDials();
  recompile();
  editor.highlight();
  touch();
  toast(`New dial “${name}”: use ${name} in your code`);
});

/** Move playing dials along at their rate. Returns true if any moved. */
function animateDials(dt: number) {
  let moved = false;
  for (const d of page.dials) {
    if (!d.playing || d.rate <= 0) continue;
    moved = true;
    const span = d.max - d.min;
    let v = d.value + d.dir * d.rate * dt;
    if (d.mode === "loop") {
      v = d.min + ((((v - d.min) % span) + span) % span);
    } else if (d.mode === "once") {
      if (v >= d.max) {
        v = d.max;
        d.playing = false;
      }
    } else {
      if (v > d.max) {
        v = d.max - (v - d.max);
        d.dir = -1;
      } else if (v < d.min) {
        v = d.min + (d.min - v);
        d.dir = 1;
      }
      v = Math.min(d.max, Math.max(d.min, v));
    }
    d.value = v;
  }
  return moved;
}

// ---- sandbox replies -----------------------------------------------------

function onFrame(r: FrameResult) {
  if (r.error) {
    showError(r.error);
    return; // keep the last good picture
  }
  showError(null);
  frame = { buf: r.buf, view: r.view };
  if (r.duration !== clock.duration) {
    clock.duration = r.duration;
    clock.seek(clock.t);
    needsFrame = true;
  }
  needsDraw = true;
}

function onTimeout() {
  clock.pause();
  for (const d of page.dials) d.playing = false;
  syncDials();
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
  editor.markError(errorLine);
}
errorBox.addEventListener("click", () => errorLine && editor.goToLine(errorLine));

// ---- toolbar -------------------------------------------------------------

$("share").addEventListener("click", async () => {
  const data = await encodeShare({ name: page.name, code: page.code, dials: page.dials as Dial[] });
  const url = `${location.origin}${location.pathname}#p=${data}`;
  try {
    await navigator.clipboard.writeText(url);
    toast("Link copied. It contains this page's code and dials.");
  } catch {
    history.replaceState(null, "", `#p=${data}`);
    toast("Couldn't copy. The link is in the address bar.");
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
    a.download = `${(page.name || "pattern").replace(/[^\w-]+/g, "-").toLowerCase()}-t${clock.t.toFixed(1)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
});

const toggle = (id: string, get: () => boolean, set: (v: boolean) => void) => {
  const b = $(id);
  b.addEventListener("click", () => {
    set(!get());
    b.setAttribute("aria-pressed", String(get()));
    needsDraw = true;
  });
};
toggle("orbit", () => orbit, (v) => (orbit = v));
toggle("grid", () => grid, (v) => (grid = v));

$("fit").addEventListener("click", () => {
  if (frame) fitCamera(view.width, view.height, frame, cam);
  needsDraw = true;
});
$("reset-view").addEventListener("click", resetView);

// Desmos-style readout of the point under the cursor (flat view only)
const coords = $("coords");
canvas.addEventListener("pointermove", (e) => {
  if (!frame || cam.yaw !== 0 || cam.pitch !== 0 || e.buttons) return void (coords.textContent = "");
  const r = canvas.getBoundingClientRect();
  const k = scaleOf(view.width, view.height, frame, cam);
  const x = (e.clientX - r.left - view.width / 2 - cam.ox) / k;
  const y = -(e.clientY - r.top - view.height / 2 - cam.oy) / k;
  const digits = Math.max(0, Math.min(6, Math.ceil(Math.log10(k / 2))));
  coords.textContent = `(${x.toFixed(digits)}, ${y.toFixed(digits)})`;
});
canvas.addEventListener("pointerleave", () => (coords.textContent = ""));

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

  if (animateDials(dt)) {
    syncDials();
    needsFrame = true;
    touch();
  }
  if (clock.t !== lastT) needsFrame = true;
  if (needsFrame) {
    sandbox.request(clock.t, clock.duration, dialValues());
    lastT = clock.t;
    needsFrame = false;
  }
  if (needsDraw && frame) {
    drawFrame(ctx, view.width, view.height, frame, cam, grid);
    needsDraw = false;
  }
  syncTimeline();
  requestAnimationFrame(tick);
}

// ---- start ---------------------------------------------------------------

async function start() {
  const hash = /^#p=([\w-]+)$/.exec(location.hash);
  const shared = hash && (await decodeShare(hash[1]));
  history.replaceState(null, "", location.pathname); // the page now lives in the notebook
  if (shared) {
    addPage(shared, `${shared.name} (shared)`);
    toast("Opened a shared page. Its code runs in a sandbox.");
  } else {
    open(stored.active ?? REF_ID);
  }
  requestAnimationFrame(tick);
}

start();
