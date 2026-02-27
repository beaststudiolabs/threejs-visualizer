import { describe, expect, it } from "vitest";
import {
  computeModePosition,
  computeSharedRatio,
  resolveSharedParticleAssignment,
  evaluateDualPalmTargets,
  isCalibrationCenter,
  mapLeftHandPose,
  mapRightHandPose,
  mapHandPose,
  mirrorWebcamX,
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

  it("evaluates mirrored left/right palm calibration targets", () => {
    expect(mirrorWebcamX(0.64)).toBeCloseTo(0.36, 5);
    expect(mirrorWebcamX(0.36)).toBeCloseTo(0.64, 5);

    const bothReady = evaluateDualPalmTargets(
      { x: 0.64, y: 0.5, z: 0 },
      { x: 0.36, y: 0.5, z: 0 }
    );
    expect(bothReady.leftTargetReady).toBe(true);
    expect(bothReady.rightTargetReady).toBe(true);
    expect(bothReady.inCenter).toBe(true);

    const leftOnly = evaluateDualPalmTargets(
      { x: 0.64, y: 0.5, z: 0 },
      { x: 0.15, y: 0.5, z: 0 }
    );
    expect(leftOnly.leftTargetReady).toBe(true);
    expect(leftOnly.rightTargetReady).toBe(false);
    expect(leftOnly.inCenter).toBe(false);

    const neither = evaluateDualPalmTargets(
      { x: 0.82, y: 0.16, z: 0 },
      { x: 0.18, y: 0.84, z: 0 }
    );
    expect(neither.leftTargetReady).toBe(false);
    expect(neither.rightTargetReady).toBe(false);
    expect(neither.inCenter).toBe(false);
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
    for (let mode = 0; mode <= 9; mode += 1) {
      const sample = computeModePosition(mode, 1.25, 0.37, 0.81);
      expect(Number.isFinite(sample.x)).toBe(true);
      expect(Number.isFinite(sample.y)).toBe(true);
      expect(Number.isFinite(sample.z)).toBe(true);
    }
  });

  it("maps left and right hands with deterministic shared logic", () => {
    const leftPalm = { x: 0.38, y: 0.49, z: -0.04 };
    const rightPalm = { x: 0.62, y: 0.51, z: 0.02 };
    const neutral = { x: 0.5, y: 0.5, z: 0 };
    const left = mapLeftHandPose(leftPalm, neutral);
    const right = mapRightHandPose(rightPalm, neutral);

    expect(left.offset.x).toBeLessThan(0);
    expect(right.offset.x).toBeGreaterThan(0);
    expect(Math.abs(left.offset.x)).toBeCloseTo(right.offset.x, 5);
    expect(left.offset.z).toBeLessThan(0);
    expect(right.offset.z).toBeGreaterThan(0);
    expect(left.fingerSignal).toBe(0);
    expect(right.fingerSignal).toBe(0);
  });

  it("computes shared particle ratio as linear clamp", () => {
    expect(computeSharedRatio(3, 7, 28)).toBe(1);
    expect(computeSharedRatio(7, 7, 28)).toBe(1);
    expect(computeSharedRatio(17.5, 7, 28)).toBeCloseTo(0.5);
    expect(computeSharedRatio(28, 7, 28)).toBe(0);
    expect(computeSharedRatio(45, 7, 28)).toBe(0);
  });

  it("resolves deterministic particle sharing buckets", () => {
    expect(resolveSharedParticleAssignment(0.12, 1)).toBe("shared");
    expect(resolveSharedParticleAssignment(0.48, 1)).toBe("shared");
    expect(resolveSharedParticleAssignment(0.96, 1)).toBe("shared");

    expect(resolveSharedParticleAssignment(0.06, 0)).toBe("left");
    expect(resolveSharedParticleAssignment(0.45, 0)).toBe("left");
    expect(resolveSharedParticleAssignment(0.5, 0)).toBe("right");
    expect(resolveSharedParticleAssignment(0.95, 0)).toBe("right");

    expect(resolveSharedParticleAssignment(0.2, 0.4)).toBe("shared");
    expect(resolveSharedParticleAssignment(0.6, 0.4)).toBe("left");
    expect(resolveSharedParticleAssignment(0.8, 0.4)).toBe("right");

    let nearShares = 0;
    let leftShares = 0;
    let rightShares = 0;
    for (let i = 1; i < 10000; i += 1) {
      const assignment = resolveSharedParticleAssignment(i / 10000, 0);
      if (assignment === "shared") {
        nearShares += 1;
      }
      if (assignment === "left") {
        leftShares += 1;
      }
      if (assignment === "right") {
        rightShares += 1;
      }
    }

    expect(nearShares).toBe(0);
    expect(Math.abs(leftShares - rightShares)).toBeLessThanOrEqual(1);
  });
});
