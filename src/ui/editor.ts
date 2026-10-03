/**
 * A small code editor on a plain <textarea>: Tab indents, Enter keeps the
 * indent, Ctrl/Cmd+Enter runs now, Escape leaves the editor (so Tab can move focus again).
 */
export function createEditor(
  area: HTMLTextAreaElement,
  handlers: { onChange: (code: string) => void; onRun: () => void },
) {
  let timer = 0;
  const changed = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => handlers.onChange(area.value), 250);
  };

  area.addEventListener("input", changed);
  area.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      clearTimeout(timer);
      handlers.onChange(area.value);
      handlers.onRun();
    } else if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      area.setRangeText("  ", area.selectionStart, area.selectionEnd, "end");
      changed();
    } else if (e.key === "Enter" && !e.shiftKey) {
      const before = area.value.slice(0, area.selectionStart);
      const indent = /[^\n]*$/.exec(before)![0].match(/^\s*/)![0];
      const extra = /[{[(]\s*$/.test(before) ? "  " : "";
      e.preventDefault();
      area.setRangeText("\n" + indent + extra, area.selectionStart, area.selectionEnd, "end");
      changed();
    } else if (e.key === "Escape") {
      area.blur();
    }
  });

  return {
    get: () => area.value,
    set(code: string) {
      clearTimeout(timer);
      area.value = code;
      area.scrollTop = 0;
    },
    /** Insert a line after the leading comment block, and run. */
    insertLine(line: string) {
      const lines = area.value.split("\n");
      let at = 0;
      while (at < lines.length && lines[at].trim().startsWith("//")) at++;
      // after any dial() lines already there
      while (at < lines.length && /\bdial\(/.test(lines[at])) at++;
      lines.splice(at, 0, line);
      area.value = lines.join("\n");
      handlers.onChange(area.value);
    },
    /** Put the cursor on a 1-based line. */
    goToLine(n: number) {
      const lines = area.value.split("\n");
      const start = lines.slice(0, n - 1).reduce((s, l) => s + l.length + 1, 0);
      area.focus();
      area.setSelectionRange(start, start + (lines[n - 1]?.length ?? 0));
    },
  };
}
