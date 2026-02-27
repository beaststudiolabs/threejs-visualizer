import { describe, expect, it } from "vitest";
import {
  computeFingerCurls,
  computeModePosition,
  computeSharedRatio,
  isBackOfHandFacingCamera,
  isCalibrationFist,
  resolveSharedParticleAssignment,
  evaluateDualPalmTargets,
  isCalibrationCenter,
  mapLeftHandPose,
  mapRightHandPose,
  mapHandPose,
  mapHandRotationPose,
  mirrorWebcamX,
  shouldActivateCalibration,
  smoothHandRotation,
  smoothBass,
  smoothHandState,
  updateCalibrationTimer
} from "../../src/wizard/math";

const createGestureLandmarks = (
  role: "left" | "right",
  pose: "fist" | "open",
  facing: "self" | "camera"
): Array<{ x: number; y: number; z: number }> => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const palmX = 0.5;
  const palmY = 0.52;
  landmarks[0] = { x: palmX, y: palmY + 0.2, z: 0 };
  landmarks[9] = { x: palmX, y: palmY, z: 0 };

  const indexOnRight = facing === "self" ? role === "left" : role === "right";
  const indexMcpX = palmX + (indexOnRight ? 0.08 : -0.08);
  const pinkyMcpX = palmX + (indexOnRight ? -0.08 : 0.08);
  const ringMcpX = (palmX + pinkyMcpX) / 2;
  const thumbMcpX = palmX + (role === "left" ? -0.11 : 0.11);
  const curled = pose === "fist";

  const setFingerChain = (
    mcpIndex: number,
    pipIndex: number,
    dipIndex: number,
    tipIndex: number,
    mcpX: number,
    mcpY: number
  ): void => {
    landmarks[mcpIndex] = { x: mcpX, y: mcpY, z: 0 };
    if (curled) {
      landmarks[pipIndex] = { x: mcpX + 0.01, y: mcpY - 0.06, z: 0 };
      landmarks[dipIndex] = { x: mcpX + 0.03, y: mcpY - 0.1, z: 0 };
      landmarks[tipIndex] = { x: mcpX + 0.005, y: mcpY - 0.02, z: 0 };
      return;
    }

    landmarks[pipIndex] = { x: mcpX, y: mcpY - 0.06, z: 0 };
    landmarks[dipIndex] = { x: mcpX, y: mcpY - 0.12, z: 0 };
    landmarks[tipIndex] = { x: mcpX, y: mcpY - 0.18, z: 0 };
  };

  setFingerChain(1, 2, 3, 4, thumbMcpX, palmY + 0.02);
  setFingerChain(5, 6, 7, 8, indexMcpX, palmY - 0.02);
  setFingerChain(9, 10, 11, 12, palmX, palmY);
  setFingerChain(13, 14, 15, 16, ringMcpX, palmY - 0.015);
  setFingerChain(17, 18, 19, 20, pinkyMcpX, palmY - 0.02);

  return landmarks;
};

const rotateX = (point: { x: number; y: number; z: number }, angle: number): { x: number; y: number; z: number } => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: point.x,
    y: point.y * c - point.z * s,
    z: point.y * s + point.z * c
  };
};

const rotateY = (point: { x: number; y: number; z: number }, angle: number): { x: number; y: number; z: number } => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: point.x * c + point.z * s,
    y: point.y,
    z: -point.x * s + point.z * c
  };
};

const rotateZ = (point: { x: number; y: number; z: number }, angle: number): { x: number; y: number; z: number } => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: point.x * c - point.y * s,
    y: point.x * s + point.y * c,
    z: point.z
  };
};

const createRotationLandmarks = (
  rotation: { x: number; y: number; z: number },
  role: "left" | "right" = "left"
): Array<{ x: number; y: number; z: number }> => {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const center = { x: 0.5, y: 0.5, z: 0 };
  const roleSign = role === "left" ? 1 : -1;

  const transform = (local: { x: number; y: number; z: number }): { x: number; y: number; z: number } => {
    let rotated = rotateX(local, rotation.x);
    rotated = rotateY(rotated, rotation.y * roleSign);
    rotated = rotateZ(rotated, rotation.z * roleSign);
    return {
      x: center.x + rotated.x,
      y: center.y + rotated.y,
      z: center.z + rotated.z
    };
  };

  const wrist = transform({ x: 0, y: -0.12, z: 0 });
  const middleMcp = transform({ x: 0, y: 0.02, z: 0 });
  const indexMcp = transform({ x: 0.08, y: 0.02, z: 0 });
  const pinkyMcp = transform({ x: -0.08, y: 0.02, z: 0 });

  landmarks[0] = wrist;
  landmarks[5] = indexMcp;
  landmarks[9] = middleMcp;
  landmarks[17] = pinkyMcp;
  return landmarks;
};

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

  it("detects calibration fists with loose curl thresholds", () => {
    expect(isCalibrationFist(createGestureLandmarks("left", "fist", "self"))).toBe(true);
    expect(isCalibrationFist(createGestureLandmarks("left", "open", "self"))).toBe(false);
  });

  it("detects back-of-hand orientation for each hand role", () => {
    const leftSelf = createGestureLandmarks("left", "fist", "self");
    const leftCamera = createGestureLandmarks("left", "fist", "camera");
    const rightSelf = createGestureLandmarks("right", "fist", "self");
    const rightCamera = createGestureLandmarks("right", "fist", "camera");

    expect(isBackOfHandFacingCamera(leftSelf, "left")).toBe(true);
    expect(isBackOfHandFacingCamera(leftCamera, "left")).toBe(false);
    expect(isBackOfHandFacingCamera(rightSelf, "right")).toBe(true);
    expect(isBackOfHandFacingCamera(rightCamera, "right")).toBe(false);
    expect(isBackOfHandFacingCamera(undefined, "left")).toBe(false);
  });

  it("maps neutral-relative hand rotations per axis", () => {
    const neutralLeft = createRotationLandmarks({ x: 0, y: 0, z: 0 }, "left");
    const rotatedLeft = createRotationLandmarks({ x: 0.32, y: 0.24, z: -0.27 }, "left");
    const leftDelta = mapHandRotationPose(rotatedLeft, neutralLeft, "left");

    expect(leftDelta.x).toBeGreaterThan(0.2);
    expect(leftDelta.y).toBeGreaterThan(0.13);
    expect(leftDelta.z).toBeLessThan(-0.15);

    const neutralRight = createRotationLandmarks({ x: 0, y: 0, z: 0 }, "right");
    const rotatedRight = createRotationLandmarks({ x: 0.25, y: -0.21, z: 0.3 }, "right");
    const rightDelta = mapHandRotationPose(rotatedRight, neutralRight, "right");

    expect(rightDelta.x).toBeGreaterThan(0.15);
    expect(rightDelta.y).toBeLessThan(-0.12);
    expect(rightDelta.z).toBeGreaterThan(0.12);
  });

  it("returns zero rotation for missing landmarks", () => {
    expect(mapHandRotationPose(undefined, undefined, "left")).toEqual({ x: 0, y: 0, z: 0 });
    expect(mapHandRotationPose(createRotationLandmarks({ x: 0, y: 0, z: 0 }), undefined, "right")).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("smooths hand rotations with shortest-angle interpolation", () => {
    const smoothed = smoothHandRotation(
      { x: Math.PI - 0.1, y: -Math.PI + 0.08, z: Math.PI - 0.05 },
      { x: -Math.PI + 0.1, y: Math.PI - 0.08, z: -Math.PI + 0.05 },
      0.5
    );

    expect(Math.abs(smoothed.x)).toBeGreaterThan(2.5);
    expect(Math.abs(smoothed.y)).toBeGreaterThan(2.5);
    expect(Math.abs(smoothed.z)).toBeGreaterThan(2.5);
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
    for (let mode = 0; mode <= 10; mode += 1) {
      const sample = computeModePosition(mode, 1.25, 0.37, 0.81);
      expect(Number.isFinite(sample.x)).toBe(true);
      expect(Number.isFinite(sample.y)).toBe(true);
      expect(Number.isFinite(sample.z)).toBe(true);
    }
  });

  it("computes low curl for a near-straight finger chain", () => {
    const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
    landmarks[1] = { x: -0.2, y: 0.2, z: 0 };
    landmarks[2] = { x: -0.35, y: 0.4, z: 0 };
    landmarks[3] = { x: -0.5, y: 0.6, z: 0 };
    landmarks[4] = { x: -0.65, y: 0.8, z: 0 };
    landmarks[5] = { x: 0.1, y: 0.1, z: 0 };
    landmarks[6] = { x: 0.1, y: 0.4, z: 0 };
    landmarks[7] = { x: 0.1, y: 0.7, z: 0 };
    landmarks[8] = { x: 0.1, y: 1.0, z: 0 };

    const curls = computeFingerCurls(landmarks);
    expect(curls.index).toBeLessThan(0.1);
    expect(curls.thumb).toBeLessThan(0.2);
  });

  it("computes higher curl when the finger bends inward", () => {
    const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
    landmarks[5] = { x: 0.1, y: 0.1, z: 0 };
    landmarks[6] = { x: 0.12, y: 0.34, z: 0 };
    landmarks[7] = { x: 0.2, y: 0.5, z: 0 };
    landmarks[8] = { x: 0.33, y: 0.32, z: 0 };
    landmarks[9] = { x: 0.4, y: 0.1, z: 0 };
    landmarks[10] = { x: 0.4, y: 0.4, z: 0 };
    landmarks[11] = { x: 0.4, y: 0.7, z: 0 };
    landmarks[12] = { x: 0.4, y: 1.0, z: 0 };

    const curls = computeFingerCurls(landmarks);
    expect(curls.index).toBeGreaterThan(0.35);
    expect(curls.middle).toBeLessThan(0.12);
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
