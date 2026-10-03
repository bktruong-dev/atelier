import "./style.css";
import { setupCanvas } from "./canvas";
import { Clock } from "./clock";
import { LayerSet } from "./layers";
import { loadNotebook, makeColorDial, makeDial, newId, saveNotebook, type Dial, type Page } from "./notebook";
import { BLANK, REFERENCES, type Template } from "./presets";
import { drawFrame, fitCamera, hasDepth, nearestPoint, newCamera, scaleOf, type Frame } from "./render";
import { DEFAULT_DURATION } from "./sandbox/ops";
import { Sandbox, type FrameResult } from "./sandbox/host";
import { decodeShare, encodeShare } from "./share";
import { applyAccent, applyBackground, clearBackgroundImage, DPR_CAP, loadBackgroundImage, loadSettings, saveSettings, storeBackgroundImage } from "./settings";
import { showIntro } from "./ui/intro";
import { createSettingsPanel } from "./ui/settings-panel";
import { renderLayers } from "./ui/layers-panel";
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
const refPages = REFERENCES.map((t, i) => fromTemplate(t, i === 0 ? REF_ID : `ref-${t.name.toLowerCase()}`));
const isRef = (p: Page) => refPages.includes(p);
let page: Page = refPages[0];

let frame: Frame | null = null;
let needsFrame = true;
let needsDraw = true;
let orbit = false;
const settings = loadSettings();
applyAccent(settings.accent);
let bgImage = loadBackgroundImage();
applyBackground(settings, bgImage);
let cinema = false;
let depth = false; // does the current frame use z?
/** Use the pattern's orbit() angle on the first frame after a page opens. */
let applyOrbit = true;
let syncDials = () => {};

const clock = new Clock(DEFAULT_DURATION);
const cam = newCamera();
const { ctx, view, resize } = setupCanvas(canvas, () => (needsDraw = true), () => DPR_CAP[settings.quality]);
const sandbox = new Sandbox(onFrame, onTimeout);
const layerSet = new LayerSet(
  () => (needsDraw = true),
  (pageId, requests) => {
    const p = findPage(pageId);
    if (p) addRequestedDials(p, requests);
  },
);
const findPage = (id: string) => refPages.find((p) => p.id === id) ?? pages.find((p) => p.id === id);

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

const camera = attachCamera(canvas, cam, {
  orbit: () => orbit,
  smooth: () => settings.smooth,
  onChange: () => (needsDraw = true),
  onReset: resetView,
});

const dialValues = () => Object.fromEntries(page.dials.map((d) => [d.name, d.kind === "color" ? d.color ?? "#86a8ff" : d.value]));

function recompile() {
  if (page.untrusted) return; // code from a link waits for the Run button
  sandbox.setCode(page.code, page.dials.map((d) => d.name));
  needsFrame = true;
}

// ---- code from a share link: shown, but paused until you choose to run it
const untrustedBanner = $("untrusted");
function showTrust() {
  untrustedBanner.hidden = !page.untrusted;
}
$("trust-run").addEventListener("click", () => {
  delete page.untrusted;
  showTrust();
  recompile();
  clock.reset();
  clock.play(1);
  touch();
});
$("trust-delete").addEventListener("click", () => {
  if (!isRef(page)) closePage(page);
});

// ---- pages ---------------------------------------------------------------

function open(id: string) {
  page = refPages.find((p) => p.id === id) ?? pages.find((p) => p.id === id) ?? refPages[0];
  applyOrbit = true;
  nameInput.value = page.name;
  nameInput.readOnly = isRef(page);
  editor.set(page.code);
  frame = null;
  camera.stop();
  hidePin();
  Object.assign(cam, newCamera());
  clock.reset();
  clock.play(1);
  showError(null);
  showTrust();
  refreshLayers();
  rebuildDials();
  recompile();
  renderTabs();
  save();
}

function addPage(t: Template, name = t.name, untrusted = false) {
  const p = fromTemplate(t, newId());
  p.name = name;
  if (untrusted) p.untrusted = true;
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
  const all = [...refPages, ...pages];
  const items = all.map((p, i) => {
    const tab = document.createElement("div");
    tab.className = "tab" + (isRef(p) ? " ref" : "") + (p === page ? " active" : "");
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
    b.title = isRef(p) ? "Reference page" : p.name;
    b.addEventListener("click", () => p !== page && open(p.id));
    b.addEventListener("dblclick", () => {
      if (!isRef(p)) {
        nameInput.focus();
        nameInput.select();
      }
    });
    tab.append(b);
    if (!isRef(p) && p === page) {
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
  dup.textContent = isRef(page) ? "Copy to notebook" : "Duplicate";
  dup.classList.toggle("primary", isRef(page));
  $("ref-note").hidden = !isRef(page);
}

let saveTimer = 0;
function touch() {
  if (!isRef(page)) page.updated = Date.now();
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 400);
}
function save() {
  if (!saveNotebook(pages, page.id)) toast("Couldn't save: this browser has storage turned off.");
}

nameInput.addEventListener("input", () => {
  if (isRef(page)) return;
  page.name = nameInput.value;
  renderTabs();
  touch();
});

$("duplicate").addEventListener("click", () => {
  const src = page;
  const copy = addPage(
    { name: src.name, code: src.code, dials: src.dials.map((d) => ({ ...d, playing: false })) },
    isRef(src) ? `${src.name} study` : `${src.name} (copy)`,
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
  refreshLayers(); // the layers' "t = dial" choices follow this page's dials
}

$("add-color").addEventListener("click", () => {
  const taken = new Set(page.dials.map((d) => d.name));
  const name = ["ink", "paint", "hue", "tint", "shade"].find((c) => !taken.has(c)) ?? `paint${page.dials.length}`;
  page.dials.push(makeColorDial(name, getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#86a8ff"));
  rebuildDials();
  recompile();
  editor.highlight();
  touch();
  toast(`New colour “${name}”: use color(${name}) in your code`);
});

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
    if (d.kind === "color" || !d.playing || d.rate <= 0) continue;
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

/**
 * dial("name", value, min, max, step) in code: make the slider if the page
 * doesn't have it, and when the code's arguments change, update the slider
 * to match. Changes made by hand on the slider stay until the code changes.
 */
function addRequestedDials(p: Page, requests: FrameResult["dialRequests"]) {
  let added = false, changed = false;
  for (const r of requests) {
    const decl = `${r.value}|${r.min}|${r.max}|${r.step}`;
    const d = p.dials.find((o) => o.name === r.name);
    if (!d) {
      p.dials.push({ ...makeDial(r.name, r.value, r.min, r.max, r.step), decl });
      added = true;
    } else if (d.kind !== "color" && d.decl !== decl) {
      const before = d.decl?.split("|").map(Number);
      d.min = r.min;
      d.max = r.max;
      d.step = r.step;
      if (!before || before[0] !== r.value) d.value = r.value; // the starting value in code changed
      d.value = Math.min(d.max, Math.max(d.min, d.value));
      d.rate = d.rate || (d.max - d.min) / 10;
      d.decl = decl;
      changed = true;
    }
  }
  if (!added && !changed) return;
  if (p === page) {
    rebuildDials();
    if (added) recompile();
    editor.highlight();
  }
  needsFrame = true;
  touch();
}

function onFrame(r: FrameResult) {
  if (r.dialRequests.length) addRequestedDials(page, r.dialRequests);
  if (r.error) {
    showError(r.error);
    return; // keep the last good picture
  }
  showError(null);
  frame = { buf: r.buf, view: r.view };
  depth = hasDepth(frame);
  if (applyOrbit) {
    applyOrbit = false;
    if (r.orbit) [cam.yaw, cam.pitch] = r.orbit;
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
  // the same background you see: ink, black, or your image (dimmed, cropped to fill)
  c.fillStyle = settings.background === "black" ? "#000" : "#0c0d10";
  c.fillRect(0, 0, out.width, out.height);
  const finish = () => {
    c.drawImage(canvas, 0, 0);
    out.toBlob(save, "image/png");
  };
  if (settings.background === "image" && bgImage) {
    const img = new Image();
    img.onload = () => {
      const k = Math.max(out.width / img.width, out.height / img.height);
      const w = img.width * k, h = img.height * k;
      c.drawImage(img, (out.width - w) / 2, (out.height - h) / 2, w, h);
      c.fillStyle = `rgba(6, 7, 9, ${settings.bgDim})`;
      c.fillRect(0, 0, out.width, out.height);
      finish();
    };
    img.onerror = finish;
    img.src = bgImage;
  } else finish();
  function save(blob: Blob | null) {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(page.name || "pattern").replace(/[^\w-]+/g, "-").toLowerCase()}-t${clock.t.toFixed(1)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
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

createSettingsPanel($("settings-panel"), $("settings-toggle"), settings, (key) => {
  saveSettings(settings);
  if (key === "accent") applyAccent(settings.accent);
  if (key === "background" || key === "bgDim") applyBackground(settings, bgImage);
  if (key === "quality") resize();
  if (key === "coords" && !settings.coords) coords.textContent = "";
  if (key === "inspect" && !settings.inspect) hidePin();
  needsDraw = true;
}, {
  get: () => bgImage,
  async pick(file) {
    bgImage = await storeBackgroundImage(file);
    applyBackground(settings, bgImage);
  },
  clear() {
    clearBackgroundImage();
    bgImage = null;
    applyBackground(settings, bgImage);
  },
});

// ---- cinema: the pattern alone, full screen, the camera drifting round 3D work
function setCinema(on: boolean) {
  cinema = on;
  document.body.classList.toggle("cinema", on);
  $("cinema").setAttribute("aria-pressed", String(on));
  hidePin();
  if (on) {
    document.documentElement.requestFullscreen?.().catch(() => {});
    if (!clock.playing) clock.play(1);
    toast("Cinema: Esc or C to leave");
  } else if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}
$("cinema").addEventListener("click", () => setCinema(!cinema));
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && cinema) setCinema(false);
});
window.addEventListener("keydown", (e) => {
  const t = e.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
  if (e.key === "c" || e.key === "C") setCinema(!cinema);
  else if (e.key === "Escape" && cinema) setCinema(false);
});

$("fit").addEventListener("click", () => {
  if (frame) fitCamera(view.width, view.height, frame, cam);
  needsDraw = true;
});
$("reset-view").addEventListener("click", resetView);

// ---- reading the canvas: cursor coordinates, and the point under the cursor
const coords = $("coords");
const pin = $("pin");
const pinLabel = $("pin-label");
function hidePin() {
  pin.hidden = true;
}
let inspectQueued = false;
let lastPointer = { x: 0, y: 0 };
canvas.addEventListener("pointermove", (e) => {
  const r0 = canvas.getBoundingClientRect();
  lastPointer = { x: e.clientX - r0.left, y: e.clientY - r0.top };
  if (settings.inspect && !e.buttons && !cinema && !inspectQueued) {
    inspectQueued = true;
    requestAnimationFrame(() => {
      inspectQueued = false;
      inspect();
    });
  } else if (e.buttons) hidePin();
  if (!settings.coords || !frame || cam.yaw !== 0 || cam.pitch !== 0 || e.buttons) return void (coords.textContent = "");
  const r = canvas.getBoundingClientRect();
  const k = scaleOf(view.width, view.height, frame, cam);
  const x = (e.clientX - r.left - view.width / 2 - cam.ox) / k;
  const y = -(e.clientY - r.top - view.height / 2 - cam.oy) / k;
  const digits = Math.max(0, Math.min(6, Math.ceil(Math.log10(k / 2))));
  coords.textContent = `(${x.toFixed(digits)}, ${y.toFixed(digits)})`;
});
canvas.addEventListener("pointerleave", () => {
  coords.textContent = "";
  hidePin();
});

/** Show the nearest drawn point's coordinates beside it. */
function inspect() {
  if (!frame) return hidePin();
  const hit = nearestPoint(view.width, view.height, frame, cam, lastPointer.x, lastPointer.y);
  if (!hit) return hidePin();
  const f = (v: number) => (Math.abs(v) >= 1000 ? v.toExponential(2) : +v.toFixed(3) + "");
  pinLabel.textContent = depth ? `x ${f(hit.x)}  y ${f(hit.y)}  z ${f(hit.z)}` : `x ${f(hit.x)}  y ${f(hit.y)}`;
  pin.style.transform = `translate(${hit.sx}px, ${hit.sy}px)`;
  pin.classList.toggle("left", hit.sx > view.width - 200);
  pin.hidden = false;
}

function resetView() {
  camera.stop();
  Object.assign(cam, newCamera());
  applyOrbit = true; // back to the pattern's own starting angle, if it has one
  needsFrame = true;
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

// ---- performance meter: fps over the last second, and the slowest draw in it
const perf = $("perf");
let perfFrames = 0, perfStart = 0, perfDraw = 0, lastDrawMs = 0;
function meter(now: number) {
  perf.hidden = !settings.fps;
  if (!settings.fps) return;
  perfFrames++;
  perfDraw = Math.max(perfDraw, lastDrawMs);
  if (now - perfStart >= 1000) {
    perf.textContent = `${Math.round((perfFrames * 1000) / (now - perfStart))} fps · draw ${perfDraw.toFixed(1)} ms`;
    perfFrames = 0;
    perfDraw = 0;
    perfStart = now;
  }
}

// ---- frame loop ----------------------------------------------------------

let last = performance.now();
let lastT = -1;
function tick(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); // no big jump after a background tab
  last = now;
  clock.tick(dt);
  if (camera.step(dt)) {
    needsDraw = true;
    hidePin();
  }
  if ((cam.yaw || cam.pitch) && coords.textContent) coords.textContent = "";
  if (cinema && depth && settings.spin && !camera.dragging()) {
    cam.yaw += (settings.spin * Math.PI / 180) * dt;
    needsDraw = true;
  }

  if (animateDials(dt)) {
    syncDials();
    needsFrame = true;
    touch();
  }
  layerSet.tick(page.layers ?? [], findPage, clock.t, (name) => {
    const d = page.dials.find((o) => o.name === name);
    return d && d.kind !== "color" ? d.value : undefined;
  });
  if (clock.t !== lastT) needsFrame = true;
  if (needsFrame && !page.untrusted) {
    sandbox.request(clock.t, clock.duration, dialValues());
    lastT = clock.t;
    needsFrame = false;
  }
  if (needsDraw && frame) {
    const d0 = performance.now();
    drawFrame(ctx, view.width, view.height, frame, cam, {
      layers: layerSet.frames(page.layers ?? []),
      grid: settings.grid && !cinema,
      glow: settings.glow && !view.light,
    });
    lastDrawMs = performance.now() - d0;
    needsDraw = false;
  }
  syncTimeline();
  meter(now);
  requestAnimationFrame(tick);
}

// ---- layers: other pages drawn underneath this one
function refreshLayers() {
  layerSet.sync(page.layers ?? []);
  const others = [...refPages, ...pages].filter((p) => p !== page);
  renderLayers($("layers"), page, others, (structural) => {
    if (structural) layerSet.sync(page.layers ?? []);
    needsDraw = true;
    touch();
  });
}
$("add-layer").addEventListener("click", () => {
  const others = [...refPages, ...pages].filter((p) => p !== page);
  if (!others.length) return;
  page.layers = [...(page.layers ?? []), { id: newId(), pageId: others[0].id, visible: true, time: "main", opacity: 0.8 }];
  refreshLayers();
  touch();
});

// ---- welcome guide: once on a first visit, and any time from the ? button
const guide = $<HTMLDialogElement>("guide");
function openGuide() {
  if (guide.open) return;
  guide.showModal();
  // start at the top (the browser otherwise focuses, and scrolls to, the first button)
  $("guide-title").focus({ preventScroll: true });
  guide.scrollTop = 0;
}
function maybeWelcome() {
  let seen = false;
  try {
    seen = localStorage.getItem("atelier.welcomed") === "1";
    localStorage.setItem("atelier.welcomed", "1");
  } catch {
    /* no storage: show it */
  }
  if (!seen) openGuide();
}
$("help").addEventListener("click", openGuide);
$("guide-close").addEventListener("click", () => {
  guide.close();
  if (page !== refPages[0]) open(REF_ID);
});
$("guide-blank").addEventListener("click", () => {
  guide.close();
  addPage(BLANK, nextUntitled());
});
guide.addEventListener("click", (e) => {
  if (e.target === guide) guide.close(); // a click on the dimmed backdrop
});

// ---- start ---------------------------------------------------------------

async function start() {
  const hash = /^#p=([\w-]+)$/.exec(location.hash);
  const shared = hash && (await decodeShare(hash[1]));
  history.replaceState(null, "", location.pathname); // the page now lives in the notebook
  if (shared) {
    addPage(shared, `${shared.name} (shared)`, true);
  } else {
    open(stored.active ?? REF_ID);
  }
  requestAnimationFrame(tick);
  if (settings.intro) showIntro(maybeWelcome);
  else maybeWelcome();
}

start();
