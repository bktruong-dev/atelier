import { API_NAMES } from "../sandbox/ops";

/**
 * A small code editor: a <textarea> over a syntax-coloured copy of its text.
 * Tab indents, Enter keeps the indent, Ctrl/Cmd+Enter runs now, Escape leaves
 * the editor so Tab moves focus again. Highlighting builds text nodes only,
 * so code is never parsed as HTML.
 */
export function createEditor(
  area: HTMLTextAreaElement,
  mirror: HTMLElement,
  handlers: { onChange: (code: string) => void; onRun: () => void; dialNames: () => string[] },
) {
  let timer = 0;
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
    syncScroll();
  }

  const syncScroll = () => {
    mirror.scrollTop = area.scrollTop;
    mirror.scrollLeft = area.scrollLeft;
  };
  area.addEventListener("scroll", syncScroll);

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
      highlight();
    },
    highlight,
    /** Put the cursor on a 1-based line. */
    goToLine(n: number) {
      const lines = area.value.split("\n");
      const start = lines.slice(0, n - 1).reduce((s, l) => s + l.length + 1, 0);
      area.focus();
      area.setSelectionRange(start, start + (lines[n - 1]?.length ?? 0));
    },
  };
}
