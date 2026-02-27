import type { TemplateRuntime } from "../contracts/schema";
import type { Modulator, ParamSchemaItem } from "../contracts/types";
import { isAutoModulator } from "./autoBindings";
import { clamp } from "../utils/math";
import { applyCurve, lfo, parseLfoRate } from "./modulators";

const parseMidiSource = (source?: string): number | undefined => {
  if (!source) return undefined;
  if (!source.startsWith("cc:")) return undefined;
  const parsed = Number.parseInt(source.slice(3), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveSource = (runtime: TemplateRuntime, mod: Modulator): number => {
  switch (mod.type) {
    case "audioBand": {
      if (mod.source === "rms") return runtime.audio.rms;
      if (mod.source === "mids") return runtime.audio.mids;
      if (mod.source === "highs") return runtime.audio.highs;
      return runtime.audio.bass;
    }
    case "audioRms":
      return runtime.audio.rms;
    case "midiCC": {
      const cc = parseMidiSource(mod.source);
      if (typeof cc !== "number") return 0;
      return runtime.midi.cc[cc] ?? 0;
    }
    case "motion":
      return runtime.motion.intensity;
    case "lfo":
      return lfo(runtime.loopT, parseLfoRate(mod.source));
    default:
      return 0;
  }
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const hue2rgb = (p: number, q: number, t: number): number => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };

  if (s === 0) {
    return [l, l, l];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
};

const toHex = (v: number): string => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0");

export const colorFromSignal = (value: number): string => {
  const hue = clamp(value, 0, 1);
  const [r, g, b] = hslToRgb(hue, 0.82, 0.56);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const applyAutoValue = (schema: ParamSchemaItem, signal: number): number | boolean | string => {
  const normalized = clamp(signal, 0, 1);

  if (schema.type === "number") {
    return schema.min + normalized * (schema.max - schema.min);
  }

  if (schema.type === "boolean") {
    return normalized >= 0.5;
  }

  if (schema.type === "select") {
    if (schema.options.length === 0) {
      return schema.default;
    }
    const maxIndex = schema.options.length - 1;
    const index = Math.min(maxIndex, Math.floor(normalized * schema.options.length));
    return schema.options[index]?.value ?? schema.default;
  }

  return colorFromSignal(normalized);
};

export class ModulatorEngine {
  apply(
    baseParams: Record<string, number | boolean | string>,
    runtime: TemplateRuntime,
    modulators: Modulator[],
    paramSchema: ParamSchemaItem[] = []
  ): Record<string, number | boolean | string> {
    const next = { ...baseParams };
    const schemaByKey = new Map(paramSchema.map((item) => [item.key, item]));

    const autoByParam = new Map<string, Modulator[]>();
    const manualMods: Modulator[] = [];

    for (const mod of modulators) {
      if (!mod.enabled) continue;
      if (isAutoModulator(mod)) {
        const bucket = autoByParam.get(mod.targetParam);
        if (bucket) {
          bucket.push(mod);
        } else {
          autoByParam.set(mod.targetParam, [mod]);
        }
        continue;
      }
      manualMods.push(mod);
    }

    for (const [targetParam, autoMods] of autoByParam.entries()) {
      const schema = schemaByKey.get(targetParam);
      if (!schema) continue;

      let signal = 0;
      for (const mod of autoMods) {
        const source = resolveSource(runtime, mod);
        const curved = applyCurve(mod.curve, source);
        const contribution = clamp(curved * Math.max(mod.amount, 0), 0, 1);
        signal = clamp(signal + contribution, 0, 1);
      }

      next[targetParam] = applyAutoValue(schema, signal);
    }

    for (const mod of manualMods) {
      const baseValue = next[mod.targetParam];
      if (typeof baseValue !== "number") continue;

      const source = resolveSource(runtime, mod);
      const curved = applyCurve(mod.curve, source);
      const span = mod.max - mod.min;
      const offset = (curved - 0.5) * span * mod.amount;
      const applied = clamp(baseValue + offset, mod.min, mod.max);

      next[mod.targetParam] = applied;
    }

    return next;
  }
}
