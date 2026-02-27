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

  it("maps auto bindings for every param type and then applies manual numeric modulation", () => {
    const engine = new ModulatorEngine();
    const out = engine.apply(
      {
        gain: 0.2,
        enabled: false,
        mode: "one",
        tint: "#101010"
      },
      runtime,
      [
        {
          id: "auto:gain:midi",
          type: "midiCC",
          source: "cc:48",
          targetParam: "gain",
          amount: 0.3,
          min: 0,
          max: 1,
          curve: "linear",
          enabled: true
        },
        {
          id: "auto:gain:motion",
          type: "motion",
          targetParam: "gain",
          amount: 0.4,
          min: 0,
          max: 1,
          curve: "linear",
          enabled: true
        },
        {
          id: "auto:enabled:audio",
          type: "audioBand",
          source: "rms",
          targetParam: "enabled",
          amount: 1,
          min: 0,
          max: 1,
          curve: "linear",
          enabled: true
        },
        {
          id: "auto:mode:motion",
          type: "motion",
          targetParam: "mode",
          amount: 1,
          min: 0,
          max: 1,
          curve: "linear",
          enabled: true
        },
        {
          id: "auto:tint:audio",
          type: "audioBand",
          source: "highs",
          targetParam: "tint",
          amount: 1,
          min: 0,
          max: 1,
          curve: "linear",
          enabled: true
        },
        {
          id: "manual-gain",
          type: "midiCC",
          source: "cc:48",
          targetParam: "gain",
          amount: 0.5,
          min: 0,
          max: 10,
          curve: "linear",
          enabled: true
        }
      ],
      [
        {
          key: "gain",
          type: "number",
          label: "Gain",
          group: "Main",
          min: 0,
          max: 10,
          default: 0
        },
        {
          key: "enabled",
          type: "boolean",
          label: "Enabled",
          group: "Main",
          default: false
        },
        {
          key: "mode",
          type: "select",
          label: "Mode",
          group: "Main",
          default: "one",
          options: [
            { label: "One", value: "one" },
            { label: "Two", value: "two" },
            { label: "Three", value: "three" }
          ]
        },
        {
          key: "tint",
          type: "color",
          label: "Tint",
          group: "Main",
          default: "#101010"
        }
      ]
    );

    expect(out.gain).toBeCloseTo(8.5, 4);
    expect(out.enabled).toBe(true);
    expect(out.mode).toBe("three");
    expect(typeof out.tint).toBe("string");
    expect((out.tint as string).startsWith("#")).toBe(true);
    expect(out.tint).not.toBe("#101010");
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
