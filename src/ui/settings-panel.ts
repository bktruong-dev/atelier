import { ACCENTS, DEFAULTS, type Accent, type Background, type Quality, type Settings } from "../settings";

/** The small settings popover behind the ⚙ button. */
export function createSettingsPanel(
  panel: HTMLElement,
  button: HTMLElement,
  s: Settings,
  onChange: (key: keyof Settings) => void,
  image: { get: () => string | null; pick: (file: File) => Promise<void>; clear: () => void },
) {
  const switches: [keyof Settings, string, string][] = [
    ["grid", "Grid", "graph paper and axes"],
    ["glow", "Glow", "soft light around lines"],
    ["inspect", "Point inspector", "hover a point to read x, y, z"],
    ["coords", "Cursor coordinates", "x, y under the cursor"],
    ["smooth", "Smooth camera", "eased zoom, gliding drags"],
    ["intro", "Opening quote", "a line on arrival"],
    ["fps", "Performance meter", "frames per second and draw time"],
  ];

  const head = document.createElement("div");
  head.className = "set-head";
  head.textContent = "Settings";

  const rows = switches.map(([key, label, hint]) => {
    const row = document.createElement("label");
    row.className = "set-row";
    const text = document.createElement("span");
    const b = document.createElement("b");
    b.textContent = label;
    const small = document.createElement("small");
    small.textContent = hint;
    text.append(b, small);
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "switch";
    input.checked = s[key] as boolean;
    input.addEventListener("change", () => {
      (s[key] as boolean) = input.checked;
      onChange(key);
    });
    row.append(text, input);
    return row;
  });

  // quality: how sharp the canvas renders
  const quality = segmented<Quality>("Quality", [["fast", "Fast"], ["balanced", "Balanced"], ["high", "Sharp"]], s.quality, (v) => {
    s.quality = v;
    onChange("quality");
  });

  // cinema spin
  const spinRow = document.createElement("label");
  spinRow.className = "set-row set-col";
  const spinText = document.createElement("span");
  const spinB = document.createElement("b");
  const spinOut = document.createElement("small");
  spinB.textContent = "Cinema spin";
  spinText.append(spinB, spinOut);
  const spin = document.createElement("input");
  spin.type = "range";
  spin.min = "0";
  spin.max = "40";
  spin.step = "1";
  spin.value = String(s.spin);
  const showSpin = () => {
    spinOut.textContent = s.spin ? `${s.spin}° a second, for 3D patterns` : "off";
    spin.style.setProperty("--fill", `${(s.spin / 40) * 100}%`);
  };
  showSpin();
  spin.addEventListener("input", () => {
    s.spin = Number(spin.value);
    showSpin();
    onChange("spin");
  });
  spinRow.append(spinText, spin);

  // accent colour
  const accentRow = document.createElement("div");
  accentRow.className = "set-row set-col";
  const accentLabel = document.createElement("b");
  accentLabel.textContent = "Accent";
  const swatches = document.createElement("div");
  swatches.className = "swatches";
  for (const [name, hex] of Object.entries(ACCENTS) as [Accent, string][]) {
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "swatch";
    sw.style.setProperty("--c", hex);
    sw.setAttribute("aria-label", `${name} accent`);
    sw.setAttribute("aria-pressed", String(s.accent === name));
    sw.addEventListener("click", () => {
      s.accent = name;
      swatches.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === sw)));
      onChange("accent");
    });
    swatches.append(sw);
  }
  accentRow.append(accentLabel, swatches);

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "set-reset";
  reset.textContent = "Restore defaults";
  reset.addEventListener("click", () => {
    Object.assign(s, DEFAULTS);
    for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) onChange(k);
    location.reload();
  });

  // background: dot grid, plain, black, or an image of your own
  const bgRow = document.createElement("div");
  bgRow.className = "set-row set-col bg-picker";
  const fileIn = document.createElement("input");
  fileIn.type = "file";
  fileIn.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
  fileIn.hidden = true;
  const imageTools = document.createElement("div");
  imageTools.className = "bg-picker";
  const fileRow = document.createElement("div");
  fileRow.className = "bg-file";
  const thumb = document.createElement("span");
  thumb.className = "bg-thumb";
  const choose = document.createElement("button");
  choose.type = "button";
  choose.textContent = "Choose image…";
  const removeImg = document.createElement("button");
  removeImg.type = "button";
  removeImg.textContent = "Remove";
  fileRow.append(thumb, choose, removeImg);
  const dimRow = document.createElement("label");
  dimRow.className = "bg-dim";
  const dimText = document.createElement("span");
  dimText.textContent = "dim";
  const dim = document.createElement("input");
  dim.type = "range";
  dim.min = "0";
  dim.max = "0.9";
  dim.step = "0.01";
  dim.value = String(s.bgDim);
  dimRow.append(dimText, dim);
  const bgError = document.createElement("p");
  bgError.className = "set-error";
  imageTools.append(fileRow, dimRow, bgError, fileIn);

  const showImageTools = () => {
    const img = image.get();
    imageTools.hidden = s.background !== "image";
    thumb.style.backgroundImage = img ? `url("${img}")` : "";
    removeImg.disabled = !img;
    choose.textContent = img ? "Change image…" : "Choose image…";
    dim.style.setProperty("--fill", `${(s.bgDim / 0.9) * 100}%`);
  };
  const bgGroup = segmented<Background>("Background", [["dots", "Dots"], ["plain", "Plain"], ["black", "Black"], ["image", "Image"]], s.background, (v) => {
    s.background = v;
    showImageTools();
    onChange("background");
    if (v === "image" && !image.get()) fileIn.click(); // nothing picked yet: ask straight away
  });
  choose.addEventListener("click", () => fileIn.click());
  fileIn.addEventListener("change", async () => {
    const file = fileIn.files?.[0];
    fileIn.value = "";
    if (!file) return;
    bgError.textContent = "";
    try {
      await image.pick(file);
      s.background = "image";
      bgGroup.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === "Image")));
      onChange("background");
    } catch (err) {
      bgError.textContent = err instanceof Error ? err.message : "Couldn't use that image.";
    }
    showImageTools();
  });
  removeImg.addEventListener("click", () => {
    image.clear();
    s.background = "dots";
    bgGroup.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === "Dots")));
    onChange("background");
    showImageTools();
  });
  dim.addEventListener("input", () => {
    s.bgDim = Number(dim.value);
    showImageTools();
    onChange("bgDim");
  });
  bgRow.append(bgGroup, imageTools);
  showImageTools();

  panel.replaceChildren(head, ...rows, quality, spinRow, accentRow, bgRow, reset);

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  };
  setOpen(false);
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(panel.hidden);
  });
  document.addEventListener("pointerdown", (e) => {
    if (!panel.hidden && !panel.contains(e.target as Node) && e.target !== button) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) setOpen(false);
  });
}

function segmented<T extends string>(label: string, options: [T, string][], value: T, onPick: (v: T) => void) {
  const row = document.createElement("div");
  row.className = "set-row set-col";
  const b = document.createElement("b");
  b.textContent = label;
  const group = document.createElement("div");
  group.className = "segmented";
  for (const [v, text] of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text;
    btn.setAttribute("aria-pressed", String(v === value));
    btn.addEventListener("click", () => {
      group.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", String(o === btn)));
      onPick(v);
    });
    group.append(btn);
  }
  row.append(b, group);
  return row;
}
