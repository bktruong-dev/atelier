import { API_NAMES } from "../sandbox/ops";

/**
 * A small code editor: a <textarea> over a syntax-coloured copy of its text,
 * with a line-number gutter. Tab / Shift+Tab indent and outdent, Enter keeps
 * the indent, Ctrl/Cmd+/ toggles comments, Ctrl/Cmd+Enter runs now, Escape
 * leaves the editor so Tab moves focus again. Edits go through insertText so
 * Ctrl+Z still works. Highlighting builds text nodes only, never HTML.
 */
export function createEditor(
  area: HTMLTextAreaElement,
  mirror: HTMLElement,
  gutter: HTMLElement,
  handlers: { onChange: (code: string) => void; onRun: () => void; dialNames: () => string[] },
) {
  let timer = 0;
  let errorLine: number | null = null;
  let lineCount = -1;

  const changed = () => {
    highlight();
    clearTimeout(timer);
    timer = window.setTimeout(() => handlers.onChange(area.value), 250);
  };

  const API = new Set(API_NAMES);
  const TOKENS =
    /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?)|(\b\d+(?:\.\d*)?(?:e[+-]?\d+)?\b|\.\d+\b)|\b(const|let|var|for|while|do|if|else|return|function|of|in|new|break|continue|true|false|null|undefined)\b|([A-Za-z_$][\w$]*)/g;

  function highlight() {
    const code = area.value;
    const dials = new Set(handlers.dialNames());
    const frag = document.createDocumentFragment();
    let last = 0;
    const add = (text: string, cls?: string) => {
      if (!cls) return frag.append(text);
      const s = document.createElement("span");
      s.className = cls;
      s.textContent = text;
      frag.append(s);
    };
    for (const m of code.matchAll(TOKENS)) {
      if (m.index! > last) add(code.slice(last, m.index));
      const [text, comment, str, num, kw, ident] = m;
      if (comment) add(text, "tok-comment");
      else if (str) add(text, "tok-string");
      else if (num) add(text, "tok-number");
      else if (kw) add(text, "tok-keyword");
      else if (ident && (ident === "t" || ident === "T")) add(text, "tok-time");
      else if (ident && dials.has(ident)) add(text, "tok-dial");
      else if (ident && API.has(ident)) add(text, "tok-api");
      else add(text);
      last = m.index! + text.length;
    }
    add(code.slice(last) + "\n");
    mirror.replaceChildren(frag);
    renderGutter();
    syncScroll();
  }

  function renderGutter(force = false) {
    const n = area.value.split("\n").length;
    if (n === lineCount && !force) return;
    lineCount = n;
    const frag = document.createDocumentFragment();
    for (let i = 1; i <= n; i++) {
      const s = document.createElement("span");
      s.textContent = String(i);
      if (i === errorLine) s.className = "gutter-error";
      frag.append(s, "\n");
    }
    gutter.replaceChildren(frag);
  }

  const syncScroll = () => {
    mirror.scrollTop = area.scrollTop;
    mirror.scrollLeft = area.scrollLeft;
    gutter.scrollTop = area.scrollTop;
  };
  area.addEventListener("scroll", syncScroll);

  /** Replace the selection, keeping the browser's undo history. */
  function insert(text: string) {
    if (!document.execCommand("insertText", false, text)) {
      area.setRangeText(text, area.selectionStart, area.selectionEnd, "end");
      changed();
    }
  }

  /** Apply fn to every line the selection touches, keeping them selected. */
  function editLines(fn: (lines: string[]) => string[]) {
    const v = area.value;
    const start = v.lastIndexOf("\n", area.selectionStart - 1) + 1;
    let end = v.indexOf("\n", Math.max(area.selectionEnd - (area.selectionEnd > area.selectionStart && v[area.selectionEnd - 1] === "\n" ? 1 : 0), start));
    if (end === -1) end = v.length;
    const next = fn(v.slice(start, end).split("\n")).join("\n");
    area.setSelectionRange(start, end);
    insert(next);
    area.setSelectionRange(start, start + next.length);
  }

  area.addEventListener("input", changed);
  area.addEventListener("keydown", (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "Enter" && mod) {
      e.preventDefault();
      clearTimeout(timer);
      handlers.onChange(area.value);
      handlers.onRun();
    } else if (e.key === "Tab" && !mod && !e.altKey) {
      e.preventDefault();
      const multi = area.value.slice(area.selectionStart, area.selectionEnd).includes("\n");
      if (e.shiftKey) editLines((ls) => ls.map((l) => l.replace(/^ {1,2}/, "")));
      else if (multi) editLines((ls) => ls.map((l) => "  " + l));
      else insert("  ");
    } else if (e.key === "/" && mod) {
      e.preventDefault();
      editLines((ls) => {
        const all = ls.filter((l) => l.trim()).every((l) => /^\s*\/\//.test(l));
        return ls.map((l) => (all ? l.replace(/^(\s*)\/\/ ?/, "$1") : l.trim() ? l.replace(/^(\s*)/, "$1// ") : l));
      });
    } else if (e.key === "Enter" && !e.shiftKey) {
      const before = area.value.slice(0, area.selectionStart);
      const indent = /[^\n]*$/.exec(before)![0].match(/^\s*/)![0];
      const extra = /[{[(]\s*$/.test(before) ? "  " : "";
      e.preventDefault();
      insert("\n" + indent + extra);
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
      highlight();
    },
    highlight,
    /** Mark a 1-based line in the gutter, or clear the mark. */
    markError(line: number | null) {
      if (line === errorLine) return;
      errorLine = line;
      renderGutter(true);
      syncScroll();
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
