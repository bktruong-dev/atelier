import type { Page } from "../notebook";

/**
 * Layers: other pages drawn underneath this one. Each row picks a page, what
 * drives its time (the main timeline, or one of this page's dials), and how
 * strongly it shows.
 */
export function renderLayers(
  root: HTMLElement,
  page: Page,
  others: Page[],
  onChange: (structural: boolean) => void,
) {
  root.replaceChildren();
  const layers = page.layers ?? [];
  if (layers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Overlay other pages here. Each can follow the timeline, or run on a dial of its own.";
    root.append(empty);
    return;
  }

  for (const l of layers) {
    const row = document.createElement("div");
    row.className = "layer" + (l.visible ? "" : " off");

    const eye = document.createElement("button");
    eye.type = "button";
    eye.className = "layer-eye";
    eye.setAttribute("aria-pressed", String(l.visible));
    eye.setAttribute("aria-label", l.visible ? "Hide layer" : "Show layer");
    eye.textContent = l.visible ? "◉" : "○";
    eye.addEventListener("click", () => {
      l.visible = !l.visible;
      onChange(false);
      renderLayers(root, page, others, onChange);
    });

    const pick = document.createElement("select");
    pick.className = "layer-page";
    pick.setAttribute("aria-label", "Page to overlay");
    for (const o of others) pick.append(new Option(o.name || "Untitled", o.id));
    if (!others.some((o) => o.id === l.pageId)) pick.append(new Option("(deleted page)", l.pageId));
    pick.value = l.pageId;
    pick.addEventListener("change", () => {
      l.pageId = pick.value;
      onChange(true);
    });

    const time = document.createElement("select");
    time.className = "layer-time";
    time.setAttribute("aria-label", "What drives this layer's time");
    time.append(new Option("⟶ with the timeline", "main"));
    for (const d of page.dials) if (d.kind !== "color") time.append(new Option(`t = ${d.name}`, d.name));
    if (l.time !== "main" && !page.dials.some((d) => d.name === l.time)) time.append(new Option(`t = ${l.time} (missing)`, l.time));
    time.value = l.time;
    time.addEventListener("change", () => {
      l.time = time.value;
      onChange(false);
    });

    const fade = document.createElement("input");
    fade.type = "range";
    fade.min = "0.05";
    fade.max = "1";
    fade.step = "0.01";
    fade.value = String(l.opacity);
    fade.className = "layer-fade";
    fade.setAttribute("aria-label", "Layer strength");
    fade.style.setProperty("--fill", `${l.opacity * 100}%`);
    fade.addEventListener("input", () => {
      l.opacity = Number(fade.value);
      fade.style.setProperty("--fill", `${l.opacity * 100}%`);
      onChange(false);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "layer-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Remove layer");
    remove.addEventListener("click", () => {
      page.layers = layers.filter((o) => o !== l);
      onChange(true);
      renderLayers(root, page, others, onChange);
    });

    const top = document.createElement("div");
    top.className = "layer-top";
    top.append(eye, pick, remove);
    const bottom = document.createElement("div");
    bottom.className = "layer-bottom";
    bottom.append(time, fade);
    row.append(top, bottom);
    root.append(row);
  }
}
