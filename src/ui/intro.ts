/**
 * The opening veil: a line about mathematics, art or computing, its letters
 * settling into place while a golden spiral draws itself behind it. Click or
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

export function showIntro() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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

  // a golden spiral (quarter arcs whose radii grow by φ) that draws itself in
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "veil-spiral");
  svg.setAttribute("viewBox", "-60 -60 120 120");
  svg.setAttribute("aria-hidden", "true");
  const phi = (1 + Math.sqrt(5)) / 2;
  let d = "M 0 0";
  let r = 0.6, x = 0, y = 0;
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (let k = 0; k < 11; k++) {
    const [dx, dy] = dirs[k % 4];
    const [nx, ny] = dirs[(k + 1) % 4];
    x += (dx + nx) * r;
    y += (dy + ny) * r;
    d += ` A ${r} ${r} 0 0 1 ${x.toFixed(3)} ${y.toFixed(3)}`;
    r *= phi;
  }
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("pathLength", "1");
  svg.append(path);

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

  veil.append(svg, fig, skip);
  document.body.append(veil);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    veil.classList.add("out");
    removeEventListener("keydown", close, true);
    setTimeout(() => veil.remove(), 900);
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
