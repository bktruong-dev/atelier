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

export interface Decl {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
}
