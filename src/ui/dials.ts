import type { Pattern, Values } from "../patterns/types";

export function renderDials(root: HTMLElement, pattern: Pattern, values: Values, onChange: () => void) {
  root.replaceChildren();
  for (const p of pattern.params) {
    const id = `dial-${p.key}`;
    const wrap = document.createElement("div");
    wrap.className = "dial";

    const label = document.createElement("label");
    label.htmlFor = id;
    const name = document.createElement("span");
    name.textContent = p.label;
    const out = document.createElement("output");
    out.htmlFor.add(id);
    label.append(name, out);

    const input = document.createElement("input");
    input.type = "range";
    input.id = id;
    input.min = String(p.min);
    input.max = String(p.max);
    input.step = String(p.step);
    input.value = String(values[p.key]);

    const show = () => (out.textContent = format(values[p.key], p.step));
    input.addEventListener("input", () => {
      values[p.key] = Number(input.value);
      show();
      onChange();
    });
    show();

    wrap.append(label, input);
    root.append(wrap);
  }
}

function format(v: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return v.toFixed(decimals);
}
