/**
 * The opening veil: a line about mathematics, art or computing, its letters
 * settling into place. Click or
 * press any key to skip. (A cousin of the quote veil on Quaderni.)
 */
const QUOTES: { q: string; who: string; when: string }[] = [
  { q: "A mathematician, like a painter or a poet, is a maker of patterns.", who: "G. H. Hardy, A Mathematician's Apology", when: "1940" },
  { q: "The Analytical Engine weaves algebraical patterns just as the Jacquard loom weaves flowers and leaves.", who: "Ada Lovelace", when: "1843" },
  { q: "Beauty is the first test: there is no permanent place in the world for ugly mathematics.", who: "G. H. Hardy", when: "1940" },
  { q: "Nature uses only the longest threads to weave her patterns.", who: "Richard Feynman, The Character of Physical Law", when: "1965" },
  { q: "Mathematics, rightly viewed, possesses not only truth, but supreme beauty.", who: "Bertrand Russell", when: "1907" },
  { q: "The book of nature is written in the language of mathematics.", who: "Galileo Galilei, after Il Saggiatore", when: "1623" },
  { q: "The purpose of computing is insight, not numbers.", who: "Richard Hamming", when: "1962" },
  { q: "Programs must be written for people to read, and only incidentally for machines to execute.", who: "Abelson & Sussman, SICP", when: "1985" },
  { q: "Geometry has two great treasures: one is the theorem of Pythagoras; the other, the division of a line into extreme and mean ratio.", who: "Johannes Kepler", when: "c. 1597" },
  { q: "Simplicity is prerequisite for reliability.", who: "Edsger Dijkstra", when: "1975" },
];

export function showIntro(onDone: () => void = () => {}) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return onDone();

  let last = -1;
  try {
    last = Number(sessionStorage.getItem("atelier.q") ?? -1);
  } catch {
    /* ignore */
  }
  let i = Math.floor(Math.random() * QUOTES.length);
  if (i === last) i = (i + 1) % QUOTES.length;
  try {
    sessionStorage.setItem("atelier.q", String(i));
  } catch {
    /* ignore */
  }
  const { q, who, when } = QUOTES[i];

  const veil = document.createElement("div");
  veil.className = "veil";
  veil.setAttribute("role", "dialog");
  veil.setAttribute("aria-label", "Quotation");

  const fig = document.createElement("figure");
  const block = document.createElement("blockquote");
  let n = 0;
  q.split(" ").forEach((word, wi) => {
    if (wi) block.append(" ");
    const w = document.createElement("span");
    w.className = "w";
    for (const ch of word) {
      const s = document.createElement("span");
      s.textContent = ch;
      s.style.setProperty("--dx", `${(Math.random() - 0.5) * 40}px`);
      s.style.setProperty("--dy", `${(Math.random() - 0.5) * 30}px`);
      s.style.transitionDelay = `${n++ * 14}ms`;
      w.append(s);
    }
    block.append(w);
  });
  const cap = document.createElement("figcaption");
  const whoEl = document.createElement("span");
  whoEl.textContent = `— ${who}, `;
  const whenEl = document.createElement("span");
  whenEl.className = "veil-when";
  whenEl.textContent = when;
  cap.append(whoEl, whenEl);
  fig.append(block, cap);

  const skip = document.createElement("span");
  skip.className = "veil-skip";
  skip.textContent = "click or press any key";

  veil.append(fig, skip);
  document.body.append(veil);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    veil.classList.add("out");
    removeEventListener("keydown", close, true);
    setTimeout(() => veil.remove(), 900);
    setTimeout(onDone, 500);
  };
  veil.addEventListener("click", close);
  addEventListener("keydown", close, true);

  const go = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        veil.classList.add("on");
        setTimeout(close, Math.max(3400, n * 14 + 2400));
      }),
    );
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(go);
}
