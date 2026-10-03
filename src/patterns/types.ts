export interface Param {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export type Values = Record<string, number>;

export interface View {
  width: number; // CSS pixels
  height: number;
  light: boolean; // draw less on small or slow screens
}

/**
 * A pattern is a pure function of time. Calling draw() with an earlier t
 * gives the earlier picture, which is all rewind and scrub need.
 */
export interface Pattern {
  id: string;
  name: string;
  /** Seconds of timeline at 1× speed. */
  duration: number;
  params: Param[];
  formula(p: Values, t: number): string;
  draw(ctx: CanvasRenderingContext2D, t: number, p: Values, view: View): void;
}

export const INK = "#e8e6e1";
export const ACCENT = "#86a8ff";
