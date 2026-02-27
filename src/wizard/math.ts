export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type Vec3WithFingers = Vec3 & {
  thumbTip?: Vec3;
  indexTip?: Vec3;
};

export type FingerCurls = {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
};

export type PalmPose = Vec3WithFingers & {
  landmarks?: Vec3[];
};

export type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type PalmCandidate = PalmPose & {
  label?: string;
};

export type PalmAssignment =
  | {
      mode: "none";
      source: "none";
    }
  | {
      mode: "single";
      source: "single";
      single: PalmPose;
    }
  | {
      mode: "dual";
      source: "labels" | "sorted";
      left: PalmPose;
      right: PalmPose;
    };

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

export const createZeroFingerCurls = (): FingerCurls => ({
  thumb: 0,
  index: 0,
  middle: 0,
  ring: 0,
  pinky: 0
});

export type PalmTarget = {
  x: number;
  y: number;
};

export type DualPalmTargetConfig = {
  leftTarget: PalmTarget;
  rightTarget: PalmTarget;
  toleranceX: number;
  toleranceY: number;
};

type DualPalmTargetConfigInput = {
  leftTarget?: Partial<PalmTarget>;
  rightTarget?: Partial<PalmTarget>;
  toleranceX?: number;
  toleranceY?: number;
};

export type DualPalmTargetState = {
  leftTargetReady: boolean;
  rightTargetReady: boolean;
  inCenter: boolean;
};

export const DEFAULT_DUAL_PALM_TARGET_CONFIG: DualPalmTargetConfig = {
  leftTarget: { x: 0.36, y: 0.5 },
  rightTarget: { x: 0.64, y: 0.5 },
  toleranceX: 0.1,
  toleranceY: 0.14
};

export const mirrorWebcamX = (rawX: number): number => clamp01(1 - rawX);

const isWithinPalmTarget = (
  displayX: number,
  y: number,
  target: PalmTarget,
  toleranceX: number,
  toleranceY: number
): boolean => Math.abs(displayX - target.x) <= toleranceX && Math.abs(y - target.y) <= toleranceY;

export const evaluateDualPalmTargets = (
  leftPalm: Vec3,
  rightPalm: Vec3,
  config: DualPalmTargetConfigInput = {}
): DualPalmTargetState => {
  const mergedConfig: DualPalmTargetConfig = {
    leftTarget: {
      x: config.leftTarget?.x ?? DEFAULT_DUAL_PALM_TARGET_CONFIG.leftTarget.x,
      y: config.leftTarget?.y ?? DEFAULT_DUAL_PALM_TARGET_CONFIG.leftTarget.y
    },
    rightTarget: {
      x: config.rightTarget?.x ?? DEFAULT_DUAL_PALM_TARGET_CONFIG.rightTarget.x,
      y: config.rightTarget?.y ?? DEFAULT_DUAL_PALM_TARGET_CONFIG.rightTarget.y
    },
    toleranceX: clamp(config.toleranceX ?? DEFAULT_DUAL_PALM_TARGET_CONFIG.toleranceX, 0, 0.45),
    toleranceY: clamp(config.toleranceY ?? DEFAULT_DUAL_PALM_TARGET_CONFIG.toleranceY, 0, 0.45)
  };

  const leftDisplayX = mirrorWebcamX(leftPalm.x);
  const rightDisplayX = mirrorWebcamX(rightPalm.x);

  const leftTargetReady = isWithinPalmTarget(
    leftDisplayX,
    leftPalm.y,
    mergedConfig.leftTarget,
    mergedConfig.toleranceX,
    mergedConfig.toleranceY
  );
  const rightTargetReady = isWithinPalmTarget(
    rightDisplayX,
    rightPalm.y,
    mergedConfig.rightTarget,
    mergedConfig.toleranceX,
    mergedConfig.toleranceY
  );

  return {
    leftTargetReady,
    rightTargetReady,
    inCenter: leftTargetReady && rightTargetReady
  };
};

export const isCalibrationCenter = (centerX: number, centerY: number, min = 0.38, max = 0.62): boolean =>
  centerX > min && centerX < max && centerY > min && centerY < max;

export const updateCalibrationTimer = (currentMs: number, inCenter: boolean, stepMs = 16): number =>
  inCenter ? currentMs + stepMs : 0;

export const shouldActivateCalibration = (timerMs: number, thresholdMs = 2000): boolean => timerMs > thresholdMs;

export const computeFingerSignal = (current: Vec3WithFingers, neutral: Vec3WithFingers, maxRange = 0.2): number => {
  if (!current.thumbTip || !current.indexTip || !neutral.thumbTip || !neutral.indexTip) {
    return 0;
  }

  const currentDistance = Math.hypot(
    current.thumbTip.x - current.indexTip.x,
    current.thumbTip.y - current.indexTip.y,
    current.thumbTip.z - current.indexTip.z
  );
  const neutralDistance = Math.hypot(
    neutral.thumbTip.x - neutral.indexTip.x,
    neutral.thumbTip.y - neutral.indexTip.y,
    neutral.thumbTip.z - neutral.indexTip.z
  );

  const range = clamp(Math.abs(maxRange), 0.001, 1);
  const delta = clamp(neutralDistance - currentDistance, -range, range);
  return clamp01((delta + range) / (2 * range));
};

const segmentDistance = (a: Vec3 | undefined, b: Vec3 | undefined): number => {
  if (!a || !b) {
    return 0;
  }
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
};

const computeCurlFromChain = (
  landmarks: Vec3[],
  mcpIndex: number,
  pipIndex: number,
  dipIndex: number,
  tipIndex: number
): number => {
  const mcp = landmarks[mcpIndex];
  const pip = landmarks[pipIndex];
  const dip = landmarks[dipIndex];
  const tip = landmarks[tipIndex];
  if (!mcp || !pip || !dip || !tip) {
    return 0;
  }

  const chain = segmentDistance(mcp, pip) + segmentDistance(pip, dip) + segmentDistance(dip, tip);
  const straight = segmentDistance(mcp, tip);
  return clamp01(1 - straight / Math.max(chain, 1e-4));
};

export const computeFingerCurls = (landmarks?: Vec3[]): FingerCurls => {
  if (!landmarks || landmarks.length < 21) {
    return createZeroFingerCurls();
  }

  return {
    thumb: computeCurlFromChain(landmarks, 1, 2, 3, 4),
    index: computeCurlFromChain(landmarks, 5, 6, 7, 8),
    middle: computeCurlFromChain(landmarks, 9, 10, 11, 12),
    ring: computeCurlFromChain(landmarks, 13, 14, 15, 16),
    pinky: computeCurlFromChain(landmarks, 17, 18, 19, 20)
  };
};

export const smoothFingerCurls = (current: FingerCurls, target: FingerCurls, lerp = 0.22): FingerCurls => {
  const amount = clamp01(lerp);
  const keep = 1 - amount;
  return {
    thumb: current.thumb * keep + target.thumb * amount,
    index: current.index * keep + target.index * amount,
    middle: current.middle * keep + target.middle * amount,
    ring: current.ring * keep + target.ring * amount,
    pinky: current.pinky * keep + target.pinky * amount
  };
};

export const mapHandPoseForModel = (
  palm: Vec3WithFingers,
  neutral: Vec3WithFingers,
  options: {
    xScale?: number;
    yScale?: number;
    zScale?: number;
    fingerRange?: number;
  } = {}
): { offset: Vec3; spread: number; fingerSignal: number } => {
  const offset = {
    x: (palm.x - neutral.x) * (options.xScale ?? 22),
    y: (palm.y - neutral.y) * (options.yScale ?? -18),
    z: (palm.z - neutral.z) * (options.zScale ?? 12)
  };
  const spread = clamp(Math.hypot(offset.x, offset.y, offset.z), 0, 3.5);
  const fingerSignal = computeFingerSignal(palm, neutral, options.fingerRange ?? 0.2);
  return { offset, spread, fingerSignal };
};

export const mapLeftHandPose = (
  palm: Vec3WithFingers,
  neutral: Vec3WithFingers,
  options: Parameters<typeof mapHandPoseForModel>[2] = {}
): { offset: Vec3; spread: number; fingerSignal: number } =>
  mapHandPoseForModel(palm, neutral, {
    xScale: options.xScale ?? 22,
    yScale: options.yScale ?? -18,
    zScale: options.zScale ?? 12,
    fingerRange: options.fingerRange ?? 0.2
  });

export const mapRightHandPose = (
  palm: Vec3WithFingers,
  neutral: Vec3WithFingers,
  options: Parameters<typeof mapHandPoseForModel>[2] = {}
): { offset: Vec3; spread: number; fingerSignal: number } =>
  mapHandPoseForModel(palm, neutral, {
    xScale: options.xScale ?? 22,
    yScale: options.yScale ?? -18,
    zScale: options.zScale ?? 12,
    fingerRange: options.fingerRange ?? 0.2
  });

export const computeSharedRatio = (distance: number, nearDistance: number, farDistance: number): number => {
  if (!Number.isFinite(distance)) {
    return 0;
  }
  if (distance <= nearDistance) {
    return 1;
  }
  if (distance >= farDistance) {
    return 0;
  }
  return 1 - clamp01((distance - nearDistance) / Math.max(0.001, farDistance - nearDistance));
};

export const resolveSharedParticleAssignment = (
  shareSeed: number,
  sharedRatio: number
): "shared" | "left" | "right" => {
  const seed = clamp01(shareSeed);
  const shared = clamp01(sharedRatio);

  const sharedRange = shared;
  const splitRange = (1 - sharedRange) * 0.5;
  const splitStart = sharedRange + splitRange;

  if (seed < sharedRange) {
    return "shared";
  }
  if (seed < splitStart) {
    return "left";
  }
  return "right";
};

export const mapHandPose = (leftPalm: Vec3, rightPalm: Vec3, neutralLeft: Vec3, neutralRight: Vec3): { offset: Vec3; spread: number } => {
  const offset = {
    x: (leftPalm.x - neutralLeft.x) * 22 - (rightPalm.x - neutralRight.x) * 8,
    y: (rightPalm.y - neutralRight.y) * -18,
    z: (leftPalm.z - neutralLeft.z) * 12
  };

  const spread = Math.hypot(leftPalm.x - rightPalm.x, leftPalm.y - rightPalm.y) * 18;

  return { offset, spread };
};

export const mapSingleHandPose = (
  palm: Vec3WithFingers,
  neutral: Vec3WithFingers
): { offset: Vec3; spread: number; fingerSignal: number } => {
  const mapped = mapHandPoseForModel(palm, neutral);
  const offset = mapped.offset;
  const motionMagnitude = Math.hypot(offset.x, offset.y, offset.z);
  const spread = clamp(motionMagnitude * 0.35, 0, 3.5);
  return { offset, spread, fingerSignal: mapped.fingerSignal };
};

export const smoothHandState = (
  currentOffset: Vec3,
  currentScale: number,
  targetOffset: Vec3,
  targetScale: number,
  lerp = 0.22
): { offset: Vec3; scale: number } => {
  const amount = clamp01(lerp);
  return {
    offset: {
      x: currentOffset.x + (targetOffset.x - currentOffset.x) * amount,
      y: currentOffset.y + (targetOffset.y - currentOffset.y) * amount,
      z: currentOffset.z + (targetOffset.z - currentOffset.z) * amount
    },
    scale: currentScale * (1 - amount) + targetScale * amount
  };
};

export const smoothBass = (previous: number, raw: number): number => {
  const normalizedRaw = clamp01(raw);
  return clamp01(previous * 0.88 + normalizedRaw * 0.12);
};

export const resolvePalmAssignment = (candidates: PalmCandidate[]): PalmAssignment => {
  if (candidates.length === 0) {
    return { mode: "none", source: "none" };
  }

  if (candidates.length === 1) {
    const palm = candidates[0];
    return {
      mode: "single",
      source: "single",
      single: {
        x: palm.x,
        y: palm.y,
        z: palm.z,
        thumbTip: palm.thumbTip,
        indexTip: palm.indexTip,
        landmarks: palm.landmarks
      }
    };
  }

  const sortedForMirroredDisplay = [...candidates].sort((a, b) => b.x - a.x);
  const leftFallback = sortedForMirroredDisplay[0];
  const rightFallback = sortedForMirroredDisplay[sortedForMirroredDisplay.length - 1];

  const leftLabeled = candidates.find((candidate) => candidate.label?.toLowerCase() === "left");
  const rightLabeled = candidates.find((candidate) => candidate.label?.toLowerCase() === "right");

  if (leftLabeled && rightLabeled) {
    return {
      mode: "dual",
      source: "labels",
      left: {
        x: leftLabeled.x,
        y: leftLabeled.y,
        z: leftLabeled.z,
        thumbTip: leftLabeled.thumbTip,
        indexTip: leftLabeled.indexTip,
        landmarks: leftLabeled.landmarks
      },
      right: {
        x: rightLabeled.x,
        y: rightLabeled.y,
        z: rightLabeled.z,
        thumbTip: rightLabeled.thumbTip,
        indexTip: rightLabeled.indexTip,
        landmarks: rightLabeled.landmarks
      }
    };
  }

  return {
    mode: "dual",
    source: "sorted",
    left: {
      x: leftFallback.x,
      y: leftFallback.y,
      z: leftFallback.z,
      thumbTip: leftFallback.thumbTip,
      indexTip: leftFallback.indexTip,
      landmarks: leftFallback.landmarks
    },
    right: {
      x: rightFallback.x,
      y: rightFallback.y,
      z: rightFallback.z,
      thumbTip: rightFallback.thumbTip,
      indexTip: rightFallback.indexTip,
      landmarks: rightFallback.landmarks
    }
  };
};

export const blendPaletteColor = (
  primary: Rgb,
  secondary: Rgb,
  accent: Rgb,
  p1: number,
  p2: number,
  base = 1
): Rgb => {
  const t1 = clamp01(p1);
  const t2 = clamp01(p2);
  const mixAB = {
    r: primary.r + (secondary.r - primary.r) * t1,
    g: primary.g + (secondary.g - primary.g) * t1,
    b: primary.b + (secondary.b - primary.b) * t1
  };
  const accentWeight = clamp01((t2 - 0.35) / 0.65) * 0.75;
  return {
    r: clamp01((mixAB.r + (accent.r - mixAB.r) * accentWeight) * base),
    g: clamp01((mixAB.g + (accent.g - mixAB.g) * accentWeight) * base),
    b: clamp01((mixAB.b + (accent.b - mixAB.b) * accentWeight) * base)
  };
};

const superFormula = (angle: number, m: number, n1: number, n2: number, n3: number, a = 1, b = 1): number => {
  const c = Math.pow(Math.abs(Math.cos((m * angle) / 4) / a), n2);
  const s = Math.pow(Math.abs(Math.sin((m * angle) / 4) / b), n3);
  return clamp(Math.pow(c + s, -1 / n1), 0, 3);
};

export const computeModePosition = (mode: number, t: number, a: number, b: number): Vec3 => {
  const pi = Math.PI;
  const tau = Math.PI * 2;
  const p = { x: 0, y: 0, z: 0 };

  if (mode === 0) {
    const theta = a * pi;
    const phi = b * tau;
    const harm = Math.sin(4 * theta) * Math.cos(5 * phi + t * 1.3) * 2.2;
    const r = 11 + harm + Math.sin(t * 2.7 + a * 11) * 1.1;
    p.x = r * Math.sin(theta) * Math.cos(phi);
    p.y = r * Math.sin(theta) * Math.sin(phi) + Math.cos(t * 1.4) * 1.5;
    p.z = r * Math.cos(theta);
    return p;
  }

  if (mode === 1) {
    const u = b * tau + t * 2.4;
    const v = (a - 0.5) * 6.8;
    const h = u * 0.5;
    const radius = 10.5;
    p.x = (radius + v * Math.cos(h)) * Math.cos(u);
    p.y = (radius + v * Math.cos(h)) * Math.sin(u);
    p.z = v * Math.sin(h);
    return p;
  }

  if (mode === 2) {
    const tu = a * tau + t * 2.1;
    const tv = b * tau + Math.sin(tu * 3.8) * 1.4;
    const radiusBig = 10;
    const radiusSmall = 3.4 + Math.sin(t * 3.3 + a * 18) * 0.9;
    p.x = (radiusBig + radiusSmall * Math.cos(tv)) * Math.cos(tu);
    p.y = (radiusBig + radiusSmall * Math.cos(tv)) * Math.sin(tu) + Math.sin(tu * 7) * 0.9;
    p.z = radiusSmall * Math.sin(tv);
    return p;
  }

  if (mode === 3) {
    const ph = t * 2.8 + a * 18;
    p.x = 10.2 * Math.sin(2.3 * ph) + 1.4 * Math.sin(8 * ph);
    p.y = 10.2 * Math.sin(3.7 * ph);
    p.z = 10.2 * Math.sin(5.9 * ph + b * 12);
    return p;
  }

  if (mode === 4) {
    const depth = Math.floor(a * 7);
    const ang = b * tau * 3.2;
    const len = 14 * Math.pow(0.61, depth);
    p.x = Math.sin(ang) * len * 0.85;
    p.y = 9.5 - depth * 2.6;
    p.z = Math.cos(ang * 1.55) * len * 0.75;
    for (let k = 0; k < 6; k += 1) {
      if (k <= depth) {
        p.x += Math.sin(t * 1.8 + k * 2.4) * 0.7;
        p.z += Math.cos(t * 1.5 + k) * 0.6;
      }
    }
    return p;
  }

  if (mode === 5) {
    const u = a * tau;
    const v = b * tau;
    const r = 4.6 * (1 - 0.5 * Math.cos(u));
    const shell = 6 + r * Math.sin(v) - Math.sin(u * 0.5) * Math.sin(v);
    p.x = shell * Math.cos(u) * 1.35;
    p.y = shell * Math.sin(u) * 1.35 + Math.sin(t * 1.8 + u) * 0.8;
    p.z = (r * Math.cos(v) + Math.cos(u * 0.5) * Math.sin(v) * 3) * 1.35;
    return p;
  }

  if (mode === 6) {
    const turns = 8;
    const ang = a * tau * turns + t * 2.4;
    const radius = 6.5 + Math.sin(b * tau + t * 2) * 1.7;
    p.x = Math.cos(ang) * radius;
    p.y = (a - 0.5) * 34 + Math.sin(ang * 0.5 + b * 4) * 1.2;
    p.z = Math.sin(ang) * radius;
    return p;
  }

  if (mode === 7) {
    const gx = (a * 2 - 1) * 4.2;
    const gy = (b * 2 - 1) * 4.2;
    const gz = Math.sin((a + b + t * 0.2) * tau) * 4.2;
    const field = Math.sin(gx) * Math.cos(gy) + Math.sin(gy) * Math.cos(gz) + Math.sin(gz) * Math.cos(gx);
    p.x = gx * 2.5 + Math.sin(t + gy) * 1.2;
    p.y = gy * 2.5 + Math.cos(t * 1.1 + gz) * 1.2;
    p.z = gz * 2.5 + field * 2.6;
    return p;
  }

  if (mode === 8) {
    const ang1 = a * tau;
    const ang2 = b * pi - pi / 2;
    const r1 = superFormula(ang1 + t * 0.35, 7, 0.35, 1.2, 1.2);
    const r2 = superFormula(ang2, 3, 0.55, 1, 1);
    const r = 11 * r1 * r2;
    p.x = r * Math.cos(ang1) * Math.cos(ang2);
    p.y = r * Math.sin(ang1) * Math.cos(ang2);
    p.z = r * Math.sin(ang2);
    const mag = Math.hypot(p.x, p.y, p.z) || 1;
    const nx = p.x / mag;
    const ny = p.y / mag;
    const nz = p.z / mag;
    p.x += nx * Math.sin(t * 2.2 + a * 14) * 1.4;
    p.y += ny * Math.sin(t * 2.2 + a * 14) * 1.4;
    p.z += nz * Math.sin(t * 2.2 + a * 14) * 1.4;
    return p;
  }

  if (mode === 9) {
    const u = a * tau;
    const pK = 3;
    const qK = 5;
    const core = 9.5 + 2.3 * Math.cos(qK * u + t * 2);
    const xk = core * Math.cos(pK * u);
    const yk = core * Math.sin(pK * u);
    const zk = 2.3 * Math.sin(qK * u + t * 2);
    const ring = b * tau;
    const tube = 1.4 + Math.sin(u * 4 + t * 1.8) * 0.35;
    p.x = xk + tube * Math.cos(ring) * Math.cos(u);
    p.y = yk + tube * Math.cos(ring) * Math.sin(u);
    p.z = zk + tube * Math.sin(ring) * 1.3;
    return p;
  }

  const palmShare = 0.46;
  const thumbShare = 0.56;
  const indexShare = 0.67;
  const middleShare = 0.78;
  const ringShare = 0.89;

  if (a < palmShare) {
    const local = a / palmShare;
    const wristTaper = 1 - Math.pow(local, 1.8);
    const theta = b * tau;
    const palmRadiusX = 3.6 + 1.7 * local;
    const palmRadiusY = 2.1 + 0.8 * local;
    p.x = Math.cos(theta) * palmRadiusX + Math.sin(t * 1.2 + local * 8) * 0.35;
    p.y = Math.sin(theta) * palmRadiusY + (local - 0.35) * 1.4;
    p.z = (0.5 - local) * 4.2 + Math.cos(theta * 2 + t * 0.8) * 0.5;
    p.x *= 0.75 + wristTaper * 0.25;
    p.y *= 0.9 + wristTaper * 0.1;
    p.z *= 0.9 + wristTaper * 0.1;
    return p;
  }

  let fingerIndex = 0;
  let start = palmShare;
  let end = thumbShare;
  if (a >= thumbShare && a < indexShare) {
    fingerIndex = 1;
    start = thumbShare;
    end = indexShare;
  } else if (a >= indexShare && a < middleShare) {
    fingerIndex = 2;
    start = indexShare;
    end = middleShare;
  } else if (a >= middleShare && a < ringShare) {
    fingerIndex = 3;
    start = middleShare;
    end = ringShare;
  } else if (a >= ringShare) {
    fingerIndex = 4;
    start = ringShare;
    end = 1;
  }

  const local = clamp01((a - start) / Math.max(1e-4, end - start));
  const ring = b * tau;
  const baseX = [-3.3, -1.25, 0.35, 1.75, 3.05][fingerIndex];
  const baseY = [-0.55, 0.95, 1.25, 1.05, 0.7][fingerIndex];
  const baseZ = [0.2, 1.1, 1.35, 1.05, 0.75][fingerIndex];
  const length = [5.0, 6.4, 7.0, 6.5, 5.6][fingerIndex];
  const radiusBase = [0.95, 0.72, 0.75, 0.7, 0.64][fingerIndex];
  const radius = radiusBase * (1 - 0.55 * local);
  const animatedCurl = 0.24 + 0.22 * (Math.sin(t * 0.75 + fingerIndex * 0.9) * 0.5 + 0.5);
  const bend = animatedCurl * (0.45 + local * local * 1.35);
  const along = local * length;

  const thumbYaw = fingerIndex === 0 ? -0.68 : 0;
  const forwardX = Math.cos(thumbYaw) * Math.cos(bend);
  const forwardY = Math.sin(bend) * (fingerIndex === 0 ? 0.75 : 1);
  const forwardZ = Math.sin(thumbYaw) * Math.cos(bend);

  p.x = baseX + forwardX * along + Math.cos(ring) * radius;
  p.y = baseY + forwardY * along + Math.sin(ring) * radius * 0.85;
  p.z = baseZ + forwardZ * along + Math.sin(ring + t * 0.25 + local * 3) * radius * 1.25;
  p.x += Math.sin(t * 1.15 + local * 12 + fingerIndex * 1.4) * 0.22;
  p.y += Math.cos(t * 1.08 + local * 10 + fingerIndex * 1.2) * 0.2;
  p.z += Math.sin(t * 0.9 + local * 13 + fingerIndex * 0.8) * 0.22;
  return p;
};
