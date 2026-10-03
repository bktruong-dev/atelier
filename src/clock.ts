/** The timeline's clock. t only ever moves by speed × real time, so it is exact at any speed. */
export class Clock {
  t = 0;
  speed = 1; // magnitude, 0.25–100
  direction: 1 | -1 = 1;
  playing = false;

  constructor(public duration: number) {}

  tick(dtSeconds: number): void {
    if (!this.playing) return;
    this.t += dtSeconds * this.speed * this.direction;
    if (this.t >= this.duration) {
      this.t = this.duration;
      this.playing = false;
    } else if (this.t <= 0) {
      this.t = 0;
      this.playing = false;
    }
  }

  play(direction: 1 | -1 = 1): void {
    this.direction = direction;
    // Playing from an end restarts from the other end.
    if (direction === 1 && this.t >= this.duration) this.t = 0;
    if (direction === -1 && this.t <= 0) this.t = this.duration;
    this.playing = true;
  }

  pause(): void {
    this.playing = false;
  }

  seek(t: number): void {
    this.t = Math.min(this.duration, Math.max(0, t));
  }

  reset(): void {
    this.t = 0;
    this.playing = false;
    this.direction = 1;
  }
}
