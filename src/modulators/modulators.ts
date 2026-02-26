import type { Curve, Modulator } from "../contracts/types";
import { clamp } from "../utils/math";

export const clampUnit = (value: number): number => clamp(value, 0, 1);

export const applyCurve = (curve: Curve, value: number): number => {
  const v = clampUnit(value);
  switch (curve) {
    case "exp":
      return v * v;
    case "log":
      return Math.log10(1 + 9 * v);
    case "smoothstep":
      return v * v * (3 - 2 * v);
    case "linear":
    default:
      return v;
  }
};

export const lfo = (loopT: number, rate = 1): number => {
  const phase = 2 * Math.PI * loopT * rate;
  return (Math.sin(phase) + 1) / 2;
};

export const parseLfoRate = (source?: string): number => {
  if (!source) return 1;
  const parsed = Number.parseFloat(source.replace("rate:", ""));
  return Number.isFinite(parsed) ? Math.max(parsed, 0.01) : 1;
};

export const createDefaultModulator = (targetParam: string): Modulator => ({
  id: crypto.randomUUID(),
  type: "lfo",
  targetParam,
  amount: 0.5,
  min: 0,
  max: 1,
  curve: "smoothstep",
  enabled: true,
  source: "rate:1"
});
