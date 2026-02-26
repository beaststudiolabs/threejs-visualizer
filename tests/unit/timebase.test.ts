import { describe, expect, it } from "vitest";
import { Timebase } from "../../src/core/Timebase";

describe("Timebase", () => {
  it("wraps loopT deterministically", () => {
    const timebase = new Timebase({ loopDurationSec: 4 });

    const f0 = timebase.step(0);
    const f1 = timebase.step(1000);
    const f2 = timebase.step(5000);

    expect(f0.loopT).toBe(0);
    expect(f1.t).toBeCloseTo(1, 5);
    expect(f1.loopT).toBeCloseTo(0.25, 5);
    expect(f2.t).toBeCloseTo(5, 5);
    expect(f2.loopT).toBeCloseTo(0.25, 5);
  });

  it("supports fixed sample time", () => {
    const timebase = new Timebase({ loopDurationSec: 4, fixedTimeSec: 1 });
    const frame = timebase.step(50_000);

    expect(frame.t).toBe(1);
    expect(frame.dt).toBe(0);
    expect(frame.loopT).toBeCloseTo(0.25, 5);
  });
});
