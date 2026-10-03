import "./style.css";
import { setupCanvas } from "./canvas";
import { Clock } from "./clock";
import { PATTERNS } from "./patterns";
import type { Pattern, Values } from "./patterns/types";
import { renderDials } from "./ui/dials";
import { createTimeline } from "./ui/timeline";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>("canvas");
const formula = $("formula");
const caption = $("caption");
const presets = $("presets");

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

let pattern: Pattern = PATTERNS[0];
let values: Values = {};
let dirty = true;
const markDirty = () => (dirty = true);

const clock = new Clock(pattern.duration);
const { ctx, view } = setupCanvas(canvas, markDirty);
const syncTimeline = createTimeline($("timeline"), clock, markDirty);

function select(next: Pattern) {
  pattern = next;
  values = Object.fromEntries(next.params.map((p) => [p.key, p.value]));
  clock.duration = next.duration;
  clock.reset();
  clock.play(1);
  const index = PATTERNS.indexOf(next);
  caption.textContent = `Fig. ${ROMAN[index] ?? index + 1} — ${next.name}`;
  for (const b of presets.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.id === next.id));
  renderDials($("dials"), next, values, markDirty);
  markDirty();
}

for (const p of PATTERNS) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = p.name;
  b.dataset.id = p.id;
  b.addEventListener("click", () => select(p));
  presets.append(b);
}

let last = performance.now();
let lastT = -1;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000); // no big jump after a background tab
  last = now;
  clock.tick(dt);

  if (dirty || clock.t !== lastT) {
    ctx.clearRect(0, 0, view.width, view.height);
    pattern.draw(ctx, clock.t, values, view);
    formula.textContent = pattern.formula(values, clock.t);
    lastT = clock.t;
    dirty = false;
  }
  syncTimeline();
  requestAnimationFrame(frame);
}

select(pattern);
requestAnimationFrame(frame);
