import { describe, expect, it } from "vitest";
import {
  computeModePosition,
  isCalibrationCenter,
  mapHandPose,
  shouldActivateCalibration,
  smoothBass,
  smoothHandState,
  updateCalibrationTimer
} from "../../src/wizard/math";

describe("wizard math helpers", () => {
  it("tracks calibration center and activation timing", () => {
    expect(isCalibrationCenter(0.5, 0.5)).toBe(true);
    expect(isCalibrationCenter(0.2, 0.5)).toBe(false);

    let timer = 0;
    for (let i = 0; i < 130; i += 1) {
      timer = updateCalibrationTimer(timer, true, 16);
    }

    expect(timer).toBe(2080);
    expect(shouldActivateCalibration(timer, 2000)).toBe(true);
    expect(updateCalibrationTimer(timer, false, 16)).toBe(0);
  });

  it("maps and smooths hand offsets", () => {
    const mapped = mapHandPose(
      { x: 0.62, y: 0.46, z: -0.1 },
      { x: 0.32, y: 0.61, z: -0.03 },
      { x: 0.5, y: 0.5, z: -0.05 },
      { x: 0.36, y: 0.55, z: -0.04 }
    );

    expect(mapped.offset.x).toBeCloseTo(2.96, 3);
    expect(mapped.offset.y).toBeCloseTo(-1.08, 3);
    expect(mapped.offset.z).toBeCloseTo(-0.6, 3);
    expect(mapped.spread).toBeGreaterThan(0);

    const smooth = smoothHandState({ x: 0, y: 0, z: 0 }, 0, mapped.offset, mapped.spread, 0.22);
    expect(smooth.offset.x).toBeCloseTo(mapped.offset.x * 0.22, 5);
    expect(smooth.scale).toBeCloseTo(mapped.spread * 0.22, 5);
  });

  it("smooths bass with bounded EMA", () => {
    let bass = 0;
    bass = smoothBass(bass, 1);
    expect(bass).toBeCloseTo(0.12, 5);
    bass = smoothBass(bass, 2);
    expect(bass).toBeLessThanOrEqual(1);
    bass = smoothBass(bass, -2);
    expect(bass).toBeGreaterThanOrEqual(0);
  });

  it("computes finite positions for every mode", () => {
    for (let mode = 0; mode <= 4; mode += 1) {
      const sample = computeModePosition(mode, 1.25, 0.37, 0.81);
      expect(Number.isFinite(sample.x)).toBe(true);
      expect(Number.isFinite(sample.y)).toBe(true);
      expect(Number.isFinite(sample.z)).toBe(true);
    }
  });
});
