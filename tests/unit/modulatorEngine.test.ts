import { describe, expect, it } from "vitest";
import type { TemplateRuntime } from "../../src/contracts/schema";
import type { Modulator } from "../../src/contracts/types";
import { ModulatorEngine } from "../../src/modulators/ModulatorEngine";

const runtime: TemplateRuntime = {
  t: 1,
  dt: 1 / 60,
  loopT: 0.5,
  seed: 1337,
  audio: {
    rms: 0.8,
    bass: 0.6,
    mids: 0.2,
    highs: 0.1,
    spectrum: new Float32Array(8),
    waveform: new Float32Array(8)
  },
  midi: {
    connected: true,
    cc: { 48: 1 }
  },
  motion: {
    enabled: true,
    intensity: 0.75
  },
  params: {
    gain: 0.5
  }
};

describe("ModulatorEngine", () => {
  it("applies clamped deterministic stacking", () => {
    const engine = new ModulatorEngine();
    const mods: Modulator[] = [
      {
        id: "a",
        type: "audioRms",
        targetParam: "gain",
        amount: 0.5,
        min: 0,
        max: 1,
        curve: "linear",
        enabled: true
      },
      {
        id: "b",
        type: "midiCC",
        source: "cc:48",
        targetParam: "gain",
        amount: 0.5,
        min: 0,
        max: 1,
        curve: "smoothstep",
        enabled: true
      }
    ];

    const out = engine.apply({ gain: 0.5 }, runtime, mods);
    expect(typeof out.gain).toBe("number");
    expect((out.gain as number) >= 0).toBe(true);
    expect((out.gain as number) <= 1).toBe(true);
  });

  it("skips non-numeric params", () => {
    const engine = new ModulatorEngine();
    const out = engine.apply(
      { mode: "on" },
      runtime,
      [
        {
          id: "m",
          type: "motion",
          targetParam: "mode",
          amount: 1,
          min: 0,
          max: 1,
          curve: "linear",
          enabled: true
        }
      ]
    );

    expect(out.mode).toBe("on");
  });
});
