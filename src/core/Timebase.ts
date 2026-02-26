import { clamp } from "../utils/math";

export type TimebaseConfig = {
  loopDurationSec: number;
  paused?: boolean;
  fixedTimeSec?: number;
};

export type TimebaseFrame = {
  t: number;
  dt: number;
  loopT: number;
};

const EPSILON = 0.0000001;

export class Timebase {
  private loopDurationSec: number;
  private paused: boolean;
  private fixedTimeSec?: number;
  private lastNowMs?: number;
  private elapsedSec = 0;

  constructor(config: TimebaseConfig) {
    this.loopDurationSec = Math.max(config.loopDurationSec, EPSILON);
    this.paused = Boolean(config.paused);
    this.fixedTimeSec = config.fixedTimeSec;
  }

  setLoopDuration(loopDurationSec: number): void {
    this.loopDurationSec = Math.max(loopDurationSec, EPSILON);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setFixedTime(fixedTimeSec?: number): void {
    this.fixedTimeSec = fixedTimeSec;
  }

  reset(): void {
    this.lastNowMs = undefined;
    this.elapsedSec = 0;
  }

  sampleAt(timeSec: number): TimebaseFrame {
    const loopT = ((timeSec % this.loopDurationSec) + this.loopDurationSec) % this.loopDurationSec;
    return {
      t: timeSec,
      dt: 0,
      loopT: clamp(loopT / this.loopDurationSec, 0, 1)
    };
  }

  step(nowMs: number): TimebaseFrame {
    if (typeof this.fixedTimeSec === "number") {
      return this.sampleAt(this.fixedTimeSec);
    }

    if (typeof this.lastNowMs !== "number") {
      this.lastNowMs = nowMs;
      return this.sampleAt(0);
    }

    const rawDt = Math.max((nowMs - this.lastNowMs) / 1000, 0);
    this.lastNowMs = nowMs;

    const dt = this.paused ? 0 : rawDt;
    this.elapsedSec += dt;

    const loopPosSec = ((this.elapsedSec % this.loopDurationSec) + this.loopDurationSec) % this.loopDurationSec;
    return {
      t: this.elapsedSec,
      dt,
      loopT: clamp(loopPosSec / this.loopDurationSec, 0, 1)
    };
  }
}
