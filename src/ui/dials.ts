import type { Decl } from "../sandbox/ops";

/** A dial's shape; when it changes the sliders are rebuilt, otherwise left alone mid-drag. */
export const dialSignature = (decls: Decl[]) => decls.map((d) => `${d.name}|${d.min}|${d.max}|${d.step}`).join(";");

export function renderDials(root: HTMLElement, decls: Decl[], onChange: (name: string, value: number) => void) {
  root.replaceChildren();
  if (decls.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = 'No dials yet. Add one with + dial, or write dial("name", value, min, max) in the code.';
    root.append(empty);
    return;
  }
  decls.forEach((d, i) => {
    const id = `dial-${i}`;
    const wrap = document.createElement("div");
    wrap.className = "dial";

    const label = document.createElement("label");
    label.htmlFor = id;
    const name = document.createElement("span");
    name.textContent = d.name;
    const out = document.createElement("output");
    out.htmlFor.add(id);
    label.append(name, out);

    const input = document.createElement("input");
    input.type = "range";
    input.id = id;
    input.min = String(d.min);
    input.max = String(d.max);
    input.step = String(d.step);
    input.value = String(d.value);

    const show = () => (out.textContent = format(Number(input.value), d.step));
    input.addEventListener("input", () => {
      show();
      onChange(d.name, Number(input.value));
    });
    show();

    wrap.append(label, input);
    root.append(wrap);
  });
}

function format(v: number, step: number): string {
  const decimals = step >= 1 ? 0 : Math.min(5, Math.ceil(-Math.log10(step) - 1e-9));
  return v.toFixed(decimals);
}
