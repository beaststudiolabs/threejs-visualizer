export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type HandRotation = Vec3;

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

const CALIBRATION_FIST_MIN_NON_THUMB_AVERAGE = 0.5;
const CALIBRATION_FIST_MIN_NON_THUMB_CURLED = 0.44;
const CALIBRATION_FIST_MIN_NON_THUMB_CURLED_COUNT = 3;
const CALIBRATION_FIST_MIN_THUMB_CURL = 0.18;
const BACK_OF_HAND_TOLERANCE_X = 0.01;

export const isCalibrationFist = (landmarks?: Vec3[]): boolean => {
  const curls = computeFingerCurls(landmarks);
  const nonThumbCurls = [curls.index, curls.middle, curls.ring, curls.pinky];
  const nonThumbAverage = nonThumbCurls.reduce((sum, value) => sum + value, 0) / nonThumbCurls.length;
  const nonThumbCurledCount = nonThumbCurls.filter((value) => value >= CALIBRATION_FIST_MIN_NON_THUMB_CURLED).length;

  return (
    nonThumbAverage >= CALIBRATION_FIST_MIN_NON_THUMB_AVERAGE &&
    nonThumbCurledCount >= CALIBRATION_FIST_MIN_NON_THUMB_CURLED_COUNT &&
    curls.thumb >= CALIBRATION_FIST_MIN_THUMB_CURL
  );
};

export const isBackOfHandFacingCamera = (landmarks: Vec3[] | undefined, role: "left" | "right"): boolean => {
  if (!landmarks || landmarks.length < 18) {
    return false;
  }
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];
  if (!indexMcp || !pinkyMcp) {
    return false;
  }

  const deltaX = indexMcp.x - pinkyMcp.x;
  if (Math.abs(deltaX) < BACK_OF_HAND_TOLERANCE_X) {
    return false;
  }

  return role === "left" ? deltaX > 0 : deltaX < 0;
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

const subtractVec3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z
});

const vec3Length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);

const normalizeVec3 = (v: Vec3): Vec3 | undefined => {
  const len = vec3Length(v);
  if (len < 1e-6) {
    return undefined;
  }
  return {
    x: v.x / len,
    y: v.y / len,
    z: v.z / len
  };
};

const crossVec3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});

const normalizeAngle = (angle: number): number => {
  if (!Number.isFinite(angle)) {
    return 0;
  }
  let next = angle;
  while (next > Math.PI) {
    next -= Math.PI * 2;
  }
  while (next < -Math.PI) {
    next += Math.PI * 2;
  }
  return next;
};

const resolveHandAxes = (landmarks: Vec3[] | undefined): { across: Vec3; forward: Vec3; normal: Vec3 } | undefined => {
  if (!landmarks || landmarks.length < 18) {
    return undefined;
  }
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const middleMcp = landmarks[9];
  const pinkyMcp = landmarks[17];
  if (!wrist || !indexMcp || !middleMcp || !pinkyMcp) {
    return undefined;
  }

  const across = normalizeVec3(subtractVec3(indexMcp, pinkyMcp));
  const forward = normalizeVec3(subtractVec3(middleMcp, wrist));
  if (!across || !forward) {
    return undefined;
  }

  const normal = normalizeVec3(crossVec3(across, forward));
  if (!normal) {
    return undefined;
  }

  return {
    across,
    forward,
    normal
  };
};

const computeHandRotation = (landmarks: Vec3[] | undefined): HandRotation | undefined => {
  const axes = resolveHandAxes(landmarks);
  if (!axes) {
    return undefined;
  }

  return {
    x: Math.atan2(axes.forward.z, Math.hypot(axes.forward.x, axes.forward.y)),
    y: Math.atan2(axes.normal.x, axes.normal.z),
    z: Math.atan2(axes.across.y, axes.across.x)
  };
};

export const mapHandRotationPose = (
  landmarks: Vec3[] | undefined,
  neutralLandmarks: Vec3[] | undefined,
  role: "left" | "right",
  mirrorByRole = true
): HandRotation => {
  const current = computeHandRotation(landmarks);
  const neutral = computeHandRotation(neutralLandmarks);
  if (!current || !neutral) {
    return { x: 0, y: 0, z: 0 };
  }

  const mirrorSign = mirrorByRole && role === "right" ? -1 : 1;
  return {
    x: normalizeAngle(current.x - neutral.x),
    y: normalizeAngle((current.y - neutral.y) * mirrorSign),
    z: normalizeAngle((current.z - neutral.z) * mirrorSign)
  };
};

export const smoothHandRotation = (current: HandRotation, target: HandRotation, lerp = 0.22): HandRotation => {
  const amount = clamp01(lerp);
  return {
    x: normalizeAngle(current.x + normalizeAngle(target.x - current.x) * amount),
    y: normalizeAngle(current.y + normalizeAngle(target.y - current.y) * amount),
    z: normalizeAngle(current.z + normalizeAngle(target.z - current.z) * amount)
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
    spreadMax?: number;
  } = {}
): { offset: Vec3; spread: number; fingerSignal: number } => {
  const spreadMax = clamp(options.spreadMax ?? 2.2, 0.01, 3.5);
  const offsetScaleX = options.xScale ?? 16;
  const offsetScaleY = options.yScale ?? -16;
  const offsetScaleZ = options.zScale ?? 10;
  const offsetClamp = spreadMax;
  const rawOffset = {
    x: (palm.x - neutral.x) * offsetScaleX,
    y: (palm.y - neutral.y) * offsetScaleY,
    z: (palm.z - neutral.z) * offsetScaleZ
  };
  const offset = {
    x: clamp(rawOffset.x, -offsetClamp, offsetClamp),
    y: clamp(rawOffset.y, -offsetClamp, offsetClamp),
    z: clamp(rawOffset.z, -offsetClamp, offsetClamp)
  };
  const spread = clamp(Math.hypot(offset.x, offset.y, offset.z), 0, spreadMax);
  const fingerSignal = computeFingerSignal(palm, neutral, options.fingerRange ?? 0.2);
  return { offset, spread, fingerSignal };
};

export const mapLeftHandPose = (
  palm: Vec3WithFingers,
  neutral: Vec3WithFingers,
  options: Parameters<typeof mapHandPoseForModel>[2] = {}
): { offset: Vec3; spread: number; fingerSignal: number } =>
  mapHandPoseForModel(palm, neutral, {
    xScale: options.xScale ?? 16,
    yScale: options.yScale ?? -16,
    zScale: options.zScale ?? 10,
    fingerRange: options.fingerRange ?? 0.2
  });

export const mapRightHandPose = (
  palm: Vec3WithFingers,
  neutral: Vec3WithFingers,
  options: Parameters<typeof mapHandPoseForModel>[2] = {}
): { offset: Vec3; spread: number; fingerSignal: number } =>
  mapHandPoseForModel(palm, neutral, {
    xScale: options.xScale ?? 16,
    yScale: options.yScale ?? -16,
    zScale: options.zScale ?? 10,
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
  const anchorPoint = (candidate: PalmCandidate): Vec3 => {
    const source = candidate.landmarks?.[9] ?? candidate.landmarks?.[0];
    if (!source) {
      return {
        x: candidate.x,
        y: candidate.y,
        z: candidate.z
      };
    }

    return {
      x: source.x,
      y: source.y,
      z: source.z
    };
  };

  const mirroredSortKey = (candidate: PalmCandidate): number => {
    const anchor = anchorPoint(candidate);
    return mirrorWebcamX(anchor.x);
  };

  if (candidates.length === 0) {
    return { mode: "none", source: "none" };
  }

  const projectToPalmPose = (candidate: PalmCandidate): PalmPose => {
    const anchor = anchorPoint(candidate);
    return {
      x: anchor.x,
      y: anchor.y,
      z: anchor.z,
      thumbTip: candidate.thumbTip,
      indexTip: candidate.indexTip,
      landmarks: candidate.landmarks
    };
  };

  if (candidates.length === 1) {
    const candidate = candidates[0];
    return {
      mode: "single",
      source: "single",
      single: projectToPalmPose(candidate)
    };
  }

  const sortedForMirroredDisplay = [...candidates].sort((a, b) => mirroredSortKey(a) - mirroredSortKey(b));
  const leftFallbackCandidate = sortedForMirroredDisplay[0];
  const rightFallbackCandidate = sortedForMirroredDisplay[sortedForMirroredDisplay.length - 1];

  const leftLabeled = candidates.find((candidate) => candidate.label?.toLowerCase() === "left");
  const rightLabeled = candidates.find((candidate) => candidate.label?.toLowerCase() === "right");

  if (
    leftLabeled &&
    rightLabeled &&
    mirroredSortKey(leftLabeled) <= mirroredSortKey(rightLabeled)
  ) {
    return {
      mode: "dual",
      source: "labels",
      left: projectToPalmPose(leftLabeled),
      right: projectToPalmPose(rightLabeled)
    };
  }

  return {
    mode: "dual",
    source: "sorted",
    left: projectToPalmPose(leftFallbackCandidate),
    right: projectToPalmPose(rightFallbackCandidate)
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
    const local = clamp01(a / palmShare);
    const palmSignal = Math.sin(t * 0.38 + b * 4.0) * 0.5 + 0.5;
    const wristTaper = 1 - Math.pow(local, 1.75);
    const theta = b * tau + t * 0.38;
    const palmWidth = 2.9 + (4.15 - 2.9) * Math.pow(local, 0.8);
    const handLift = -1.2 + local * 2.55;

    p.x = Math.cos(theta) * palmWidth;
    p.y = Math.sin(theta) * 1.05 * (0.78 + 0.22 * local) + handLift;
    p.z = (0.62 - local) * 3.5 + Math.cos(theta * 1.6 + t * 0.8) * 0.48;
    p.x *= 0.75 + wristTaper * 0.25;
    p.y *= 1.12 - 0.12 * wristTaper;
    p.z *= 0.7 + 0.25 * (1 - local);
    p.x += Math.sin(theta * 2.0 + t * 0.9 + local * 4.0) * (0.07 + palmSignal * 0.06);
    p.y += Math.cos(theta * 2.1 + t * 1.1) * (0.05 + palmSignal * 0.04);
    p.z += Math.sin(t * 1.2 + local * 9.0) * 0.06;
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
  const segment1 = clamp01(local * 3);
  const segment2 = clamp01((local - 0.333) / 0.333);
  const segment3 = clamp01((local - 0.666) / 0.334);
  const animatedCurl = 0.24 + 0.22 * (Math.sin(t * 0.75 + fingerIndex * 0.9) * 0.5 + 0.5);
  const curl = Math.min(1, Math.max(0, animatedCurl));
  const curlEase = Math.sqrt(curl);
  const isThumb = fingerIndex === 0;

  let baseX = -3.15;
  let baseY = -0.38;
  let baseZ = 0.72;
  let phalanx1 = 2.05;
  let phalanx2 = 1.85;
  let phalanx3 = 1.35;
  let radiusBase = 0.88;
  if (fingerIndex === 1) {
    baseX = -1.25;
    baseY = 0.84;
    baseZ = 1.15;
    phalanx1 = 2.45;
    phalanx2 = 2.0;
    phalanx3 = 1.45;
    radiusBase = 0.76;
  } else if (fingerIndex === 2) {
    baseX = 0.42;
    baseY = 1.02;
    baseZ = 1.35;
    phalanx1 = 2.65;
    phalanx2 = 2.15;
    phalanx3 = 1.65;
    radiusBase = 0.79;
  } else if (fingerIndex === 3) {
    baseX = 1.68;
    baseY = 1.0;
    baseZ = 1.08;
    phalanx1 = 2.52;
    phalanx2 = 2.05;
    phalanx3 = 1.58;
    radiusBase = 0.74;
  } else if (fingerIndex === 4) {
    baseX = 3.0;
    baseY = 0.64;
    baseZ = 0.85;
    phalanx1 = 2.25;
    phalanx2 = 1.85;
    phalanx3 = 1.4;
    radiusBase = 0.68;
  }

  const pitchBase = isThumb ? 0.42 : 0.55;
  const pitchMid = pitchBase + curlEase * 1.05;
  const pitchTip = pitchBase + 1.08 + curlEase * 1.45;
  const yaw = isThumb ? -0.74 : 0;

  const bone1 = {
    x: Math.cos(yaw) * Math.cos(pitchBase),
    y: Math.sin(pitchBase),
    z: Math.sin(yaw) * Math.cos(pitchBase)
  };
  const bone2 = {
    x: Math.cos(yaw) * Math.cos(pitchMid),
    y: Math.sin(pitchMid),
    z: Math.sin(yaw) * Math.cos(pitchMid)
  };
  const bone3 = {
    x: Math.cos(yaw) * Math.cos(pitchTip),
    y: Math.sin(pitchTip),
    z: Math.sin(yaw) * Math.cos(pitchTip)
  };

  const fingerCore = {
    x: bone1.x * (phalanx1 * segment1) + bone2.x * (phalanx2 * segment2) + bone3.x * (phalanx3 * segment3),
    y: bone1.y * (phalanx1 * segment1) + bone2.y * (phalanx2 * segment2) + bone3.y * (phalanx3 * segment3),
    z: bone1.z * (phalanx1 * segment1) + bone2.z * (phalanx2 * segment2) + bone3.z * (phalanx3 * segment3)
  };

  const ring = b * tau;
  const radius = radiusBase * (1 - 0.58 * local);
  const phalanxTaper = 0.58 + 0.42 * (1 - local);
  p.x = baseX + fingerCore.x + Math.cos(ring) * radius * 0.75;
  p.y = baseY + fingerCore.y + Math.sin(ring) * radius * 1.35 * phalanxTaper;
  p.z = baseZ + fingerCore.z + Math.cos(ring + local * 2) * radius * 0.9 * phalanxTaper;
  const detailNoise = 0.06 * Math.sin(t * 6.0 + a * 74 + b * 45);
  p.x += detailNoise * Math.cos(ring);
  p.y += detailNoise * Math.sin(ring * 1.8);
  p.z += detailNoise * Math.cos(ring * 0.8);

  return p;
};
