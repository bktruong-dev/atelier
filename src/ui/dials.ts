import type { Dial, DialMode } from "../notebook";
import { badDialName } from "../sandbox/ops";

export interface DialHandlers {
  /** The value moved (slider, typing or animation). */
  onValue(d: Dial): void;
  /** Range, step, rate, mode or play state changed. */
  onSettings(d: Dial): void;
  /** Renamed; the caller updates the code and recompiles. */
  onRename(d: Dial, from: string): void;
  onRemove(d: Dial): void;
}

/**
 * Desmos-style dials: ▶ name = value, a slider with editable ends,
 * and a drawer for step, rate and how it plays.
 */
export function renderDials(root: HTMLElement, dials: Dial[], h: DialHandlers, openName: string | null = null) {
  root.replaceChildren();
  const rows: { d: Dial; sync: () => void }[] = [];

  if (dials.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No dials yet. Add one, then use its name in the code.";
    root.append(empty);
  }

  for (const d of dials) {
    if (d.kind === "color") {
      rows.push({ d, sync: colorRow(root, d, dials, h) });
      continue;
    }
    const row = el("div", "dial");

    // ▶  name  =  value  ⋯
    const top = el("div", "dial-top");
    const play = button("play", "");
    const name = el("span", "dial-name");
    const eq = el("span", "dial-eq");
    eq.textContent = "=";
    const value = input("number", "dial-value");
    value.setAttribute("aria-label", `${d.name} value`);
    const more = button("dial-more", "⋯");
    more.setAttribute("aria-label", `${d.name} settings`);
    top.append(play, name, eq, value, more);

    // min ───●─── max
    const track = el("div", "dial-track");
    const lo = input("number", "dial-end");
    const hi = input("number", "dial-end");
    lo.setAttribute("aria-label", `${d.name} minimum`);
    hi.setAttribute("aria-label", `${d.name} maximum`);
    const slider = input("range", "");
    slider.setAttribute("aria-label", d.name);
    track.append(lo, slider, hi);

    // drawer
    const drawer = el("div", "dial-drawer");
    drawer.hidden = d.name !== openName;
    more.setAttribute("aria-expanded", String(!drawer.hidden));
    const nameIn = input("text", "");
    nameIn.value = d.name;
    nameIn.spellcheck = false;
    const stepIn = input("number", "");
    const rateIn = input("number", "");
    rateIn.min = "0";
    const modeIn = document.createElement("select");
    for (const [v, label] of [["bounce", "↔ bounce"], ["loop", "→ loop"], ["once", "→| once"]]) modeIn.append(new Option(label, v));
    const remove = button("dial-remove", "Remove dial");
    const nameErr = el("p", "dial-error");
    drawer.append(
      field("name", nameIn),
      field("step", stepIn),
      field("rate /s", rateIn),
      field("play", modeIn),
      nameErr,
      remove,
    );

    row.append(top, track, drawer);
    root.append(row);

    const decimals = () => (d.step >= 1 ? 0 : Math.min(5, Math.ceil(-Math.log10(d.step) - 1e-9)));
    const sync = () => {
      play.textContent = d.playing ? "❚❚" : "▶";
      play.setAttribute("aria-label", `${d.playing ? "Stop" : "Animate"} ${d.name}`);
      play.setAttribute("aria-pressed", String(d.playing));
      name.textContent = d.name;
      if (document.activeElement !== value) value.value = d.value.toFixed(decimals());
      if (document.activeElement !== slider) {
        slider.min = String(d.min);
        slider.max = String(d.max);
        slider.step = "any";
        slider.value = String(d.value);
      }
      slider.style.setProperty("--fill", `${((d.value - d.min) / (d.max - d.min)) * 100}%`);
      if (document.activeElement !== lo) lo.value = String(d.min);
      if (document.activeElement !== hi) hi.value = String(d.max);
      if (document.activeElement !== stepIn) stepIn.value = String(d.step);
      if (document.activeElement !== rateIn) rateIn.value = String(+d.rate.toPrecision(4));
      modeIn.value = d.mode;
    };
    sync();
    rows.push({ d, sync });

    const snap = (v: number) => {
      const s = Math.round((v - d.min) / d.step) * d.step + d.min;
      return +Math.min(d.max, Math.max(d.min, s)).toFixed(10);
    };

    play.addEventListener("click", () => {
      d.playing = !d.playing;
      if (d.playing && d.mode === "once" && d.value >= d.max) d.value = d.min;
      sync();
      h.onSettings(d);
    });
    slider.addEventListener("input", () => {
      d.value = snap(Number(slider.value));
      sync();
      h.onValue(d);
    });
    value.addEventListener("change", () => {
      const v = Number(value.value);
      if (!Number.isFinite(v)) return sync();
      // like Desmos: typing past an end moves the end
      if (v < d.min) d.min = v;
      if (v > d.max) d.max = v;
      d.value = v;
      sync();
      h.onSettings(d);
    });
    const setEnd = (which: "min" | "max", box: HTMLInputElement) => {
      const v = Number(box.value);
      const other = which === "min" ? d.max : d.min;
      if (!Number.isFinite(v) || (which === "min" ? v >= other : v <= other)) return sync();
      d[which] = v;
      d.value = Math.min(d.max, Math.max(d.min, d.value));
      sync();
      h.onSettings(d);
    };
    lo.addEventListener("change", () => setEnd("min", lo));
    hi.addEventListener("change", () => setEnd("max", hi));
    stepIn.addEventListener("change", () => {
      const v = Number(stepIn.value);
      if (Number.isFinite(v) && v > 0) {
        d.step = v;
        d.value = snap(d.value); // land on the new grid straight away
      }
      sync();
      h.onSettings(d);
    });
    rateIn.addEventListener("change", () => {
      const v = Number(rateIn.value);
      if (Number.isFinite(v) && v >= 0) d.rate = v;
      sync();
      h.onSettings(d);
    });
    modeIn.addEventListener("change", () => {
      d.mode = modeIn.value as DialMode;
      h.onSettings(d);
    });
    more.addEventListener("click", () => {
      drawer.hidden = !drawer.hidden;
      more.setAttribute("aria-expanded", String(!drawer.hidden));
    });
    name.addEventListener("click", () => {
      drawer.hidden = false;
      more.setAttribute("aria-expanded", "true");
      nameIn.focus();
      nameIn.select();
    });
    nameIn.addEventListener("change", () => {
      const next = nameIn.value.trim();
      if (next === d.name) return;
      const problem = badDialName(next) ?? (dials.some((o) => o !== d && o.name === next) ? `There is already a dial called “${next}”.` : null);
      nameErr.textContent = problem ?? "";
      if (problem) {
        nameIn.addEventListener("blur", () => {
          nameIn.value = d.name;
          nameErr.textContent = "";
        }, { once: true });
        return;
      }
      const from = d.name;
      d.name = next;
      h.onRename(d, from);
    });
    remove.addEventListener("click", () => h.onRemove(d));
  }

  /** Call when values change from outside (animation). */
  return () => rows.forEach((r) => r.sync());
}

/** A colour dial: swatch, hex and a name you can change. */
function colorRow(root: HTMLElement, d: Dial, dials: Dial[], h: DialHandlers) {
  const row = el("div", "dial dial-color");
  const top = el("div", "dial-top");
  const swatch = input("color", "dial-swatch");
  swatch.setAttribute("aria-label", `${d.name} colour`);
  const name = el("span", "dial-name");
  const eq = el("span", "dial-eq");
  eq.textContent = "=";
  const hex = input("text", "dial-value");
  hex.spellcheck = false;
  hex.setAttribute("aria-label", `${d.name} hex`);
  const more = button("dial-more", "⋯");
  more.setAttribute("aria-label", `${d.name} settings`);
  top.append(swatch, name, eq, hex, more);

  const drawer = el("div", "dial-drawer");
  drawer.hidden = true;
  const nameIn = input("text", "");
  nameIn.spellcheck = false;
  const nameErr = el("p", "dial-error");
  const remove = button("dial-remove", "Remove dial");
  drawer.append(field("name", nameIn), nameErr, remove);
  row.append(top, drawer);
  root.append(row);

  const sync = () => {
    name.textContent = d.name;
    swatch.value = d.color ?? "#86a8ff";
    if (document.activeElement !== hex) hex.value = d.color ?? "";
    nameIn.value = d.name;
    row.style.setProperty("--swatch", d.color ?? "#86a8ff");
  };
  sync();

  const set = (c: string) => {
    if (!/^#[0-9a-f]{6}$/i.test(c)) return sync();
    d.color = c.toLowerCase();
    sync();
    h.onValue(d);
  };
  swatch.addEventListener("input", () => set(swatch.value));
  hex.addEventListener("change", () => set(hex.value.trim().startsWith("#") ? hex.value.trim() : "#" + hex.value.trim()));
  more.addEventListener("click", () => (drawer.hidden = !drawer.hidden));
  name.addEventListener("click", () => {
    drawer.hidden = false;
    nameIn.focus();
    nameIn.select();
  });
  nameIn.addEventListener("change", () => {
    const next = nameIn.value.trim();
    if (next === d.name) return;
    const problem = badDialName(next) ?? (dials.some((o) => o !== d && o.name === next) ? `There is already a dial called “${next}”.` : null);
    nameErr.textContent = problem ?? "";
    if (problem) return;
    const from = d.name;
    d.name = next;
    h.onRename(d, from);
  });
  remove.addEventListener("click", () => h.onRemove(d));
  return sync;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
function button(cls: string, text: string) {
  const b = el("button", cls);
  b.type = "button";
  b.textContent = text;
  return b;
}
function input(type: string, cls: string) {
  const i = el("input", cls);
  i.type = type;
  if (type === "number") i.step = "any";
  return i;
}
function field(label: string, control: HTMLElement) {
  const l = el("label", "dial-field");
  const s = el("span", "");
  s.textContent = label;
  l.append(s, control);
  return l;
}
