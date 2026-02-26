import type { TemplateRuntime } from "../contracts/schema";
import type { Modulator } from "../contracts/types";
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

export class ModulatorEngine {
  apply(
    baseParams: Record<string, number | boolean | string>,
    runtime: TemplateRuntime,
    modulators: Modulator[]
  ): Record<string, number | boolean | string> {
    const next = { ...baseParams };

    for (const mod of modulators) {
      if (!mod.enabled) continue;

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
