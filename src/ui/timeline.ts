import type { Clock } from "../clock";

const SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 25, 100];

export function createTimeline(root: HTMLElement, clock: Clock, onSeek: () => void) {
  // An endless pattern has no last second, so the scrubber spans what you've
  // played so far plus some room, and grows as time runs on.
  let furthest = 0;
  const span = () => (Number.isFinite(clock.duration) ? clock.duration : Math.max(30, furthest * 1.25));

  const button = (text: string, label: string) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.setAttribute("aria-label", label);
    b.title = label;
    return b;
  };

  const reset = button("⏮", "Reset");
  const rewind = button("◀◀", "Rewind");
  const play = button("▶", "Play");
  const scrub = document.createElement("input");
  scrub.type = "range";
  scrub.className = "scrub";
  scrub.min = "0";
  scrub.max = "1000";
  scrub.step = "1";
  scrub.setAttribute("aria-label", "Time");

  const speed = document.createElement("select");
  speed.setAttribute("aria-label", "Speed");
  for (const s of SPEEDS) {
    const o = document.createElement("option");
    o.value = String(s);
    o.textContent = `${s}×`;
    speed.append(o);
  }
  speed.value = "1";

  const time = document.createElement("span");
  time.className = "time";

  const loop = button("↻", "Loop");
  loop.setAttribute("aria-pressed", "false");
  loop.addEventListener("click", () => {
    clock.loop = !clock.loop;
    loop.setAttribute("aria-pressed", String(clock.loop));
  });

  root.replaceChildren(reset, rewind, play, scrub, loop, speed, time);

  reset.addEventListener("click", () => {
    clock.reset();
    onSeek();
  });
  rewind.addEventListener("click", () => {
    if (clock.playing && clock.direction === -1) clock.pause();
    else clock.play(-1);
  });
  play.addEventListener("click", () => {
    if (clock.playing && clock.direction === 1) clock.pause();
    else clock.play(1);
  });

  let wasPlaying = false;
  scrub.addEventListener("pointerdown", () => {
    wasPlaying = clock.playing;
    clock.pause();
  });
  scrub.addEventListener("input", () => {
    clock.seek((Number(scrub.value) / 1000) * span());
    onSeek();
  });
  scrub.addEventListener("change", () => {
    if (wasPlaying) clock.play(clock.direction);
    wasPlaying = false;
  });
  speed.addEventListener("change", () => (clock.speed = Number(speed.value)));

  window.addEventListener("keydown", (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
    if (e.key === " ") {
      e.preventDefault();
      play.click();
    }
  });

  /** Call once per frame to reflect the clock. */
  return function sync() {
    const forward = clock.playing && clock.direction === 1;
    const backward = clock.playing && clock.direction === -1;
    play.textContent = forward ? "⏸" : "▶";
    play.setAttribute("aria-label", forward ? "Pause" : "Play");
    rewind.setAttribute("aria-pressed", String(backward));
    const endless = !Number.isFinite(clock.duration);
    if (clock.t < 0.001) furthest = 0; // a reset or a new page
    // grow the window in steps, so the thumb doesn't creep backwards every frame
    if (endless && clock.t > span() * 0.9) furthest = clock.t;
    if (document.activeElement !== scrub) scrub.value = String(Math.round((clock.t / span()) * 1000));
    scrub.style.setProperty("--fill", `${(Number(scrub.value) / 10).toFixed(1)}%`);
    time.textContent = endless ? `t = ${clock.t.toFixed(2)} / ∞` : `t = ${clock.t.toFixed(2)} / ${+clock.duration.toFixed(2)}s`;
    time.title = endless ? "This pattern never ends" : "";
    loop.disabled = endless;
  };
}
