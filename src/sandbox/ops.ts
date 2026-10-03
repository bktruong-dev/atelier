/**
 * Drawing commands, packed into one Float32Array per frame.
 * The worker writes them; the main page only ever reads numbers back.
 */
export const OP = {
  COLOR: 0, // r g b a   (0–255, 0–255, 0–255, 0–1)
  SIZE: 1, //  px        point diameter
  WIDTH: 2, // px        stroke width
  DOT: 3, //   x y z
  MOVE: 4, //  x y z     start a path (or a break in one)
  LINE: 5, //  x y z
  CLOSE: 6,
  STROKE: 7,
} as const;

/** Floats per frame, about a million points. */
export const MAX_FLOATS = 4_000_000;

export const DEFAULT_DURATION = 10;
export const DEFAULT_VIEW = 2;

/** Everything pattern code can call. Dial names may not reuse these. */
export const API_NAMES = [
  "duration", "view", "orbit", "dot", "line", "path", "color", "hsl", "pointSize", "strokeWidth",
  "lerp", "clamp", "range", "random", "TAU", "PHI",
  ...Object.getOwnPropertyNames(Math).filter((k) => k !== "random"),
];

const RESERVED = new Set([
  ...API_NAMES, "t", "T", "__api", "__dials",
  "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do",
  "else", "export", "extends", "false", "finally", "for", "function", "if", "import", "in",
  "instanceof", "let", "new", "null", "return", "static", "super", "switch", "this", "throw",
  "true", "try", "typeof", "undefined", "var", "void", "while", "with", "yield", "await",
  "async", "of", "eval", "arguments", "NaN", "Infinity", "self", "globalThis", "Math",
]);

/** Why a dial name can't be used, or null if it's fine. */
export function badDialName(name: string): string | null {
  if (!/^[A-Za-z_$][\w$]{0,23}$/.test(name)) return "Use letters, digits or _, starting with a letter.";
  if (RESERVED.has(name)) return `“${name}” is already a built-in name.`;
  return null;
}
