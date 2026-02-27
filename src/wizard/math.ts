export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

export const isCalibrationCenter = (centerX: number, centerY: number): boolean =>
  centerX > 0.42 && centerX < 0.58 && centerY > 0.42 && centerY < 0.58;

export const updateCalibrationTimer = (currentMs: number, inCenter: boolean, stepMs = 16): number =>
  inCenter ? currentMs + stepMs : 0;

export const shouldActivateCalibration = (timerMs: number, thresholdMs = 2000): boolean => timerMs > thresholdMs;

export const mapHandPose = (leftPalm: Vec3, rightPalm: Vec3, neutralLeft: Vec3, neutralRight: Vec3): { offset: Vec3; spread: number } => {
  const offset = {
    x: (leftPalm.x - neutralLeft.x) * 22 - (rightPalm.x - neutralRight.x) * 8,
    y: (rightPalm.y - neutralRight.y) * -18,
    z: (leftPalm.z - neutralLeft.z) * 12
  };

  const spread = Math.hypot(leftPalm.x - rightPalm.x, leftPalm.y - rightPalm.y) * 18;

  return { offset, spread };
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
};
