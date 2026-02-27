import { beforeEach, describe, expect, it } from "vitest";
import type { PresetV1 } from "../../src/contracts/types";
import { PresetManager } from "../../src/presets/PresetManager";

const makePreset = (name: string): PresetV1 => ({
  version: 1,
  name,
  templateId: "wireframeBlob",
  seed: 1337,
  params: { density: 2 },
  camera: {
    mode: "orbit",
    position: [0, 0, 5],
    target: [0, 0, 0],
    fov: 60
  },
  palette: {
    background: "#000000",
    primary: "#11ff88",
    secondary: "#88ccff",
    accent: "#ffaa55"
  },
  modulators: [],
  midiMappings: []
});

describe("PresetManager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("roundtrips save and load", () => {
    const manager = new PresetManager("test-presets", { seedFactoryPresets: false });
    const preset = makePreset("alpha");

    manager.save(preset);

    expect(manager.list()).toHaveLength(1);
    expect(manager.load("alpha")?.seed).toBe(1337);
  });

  it("imports and exports JSON", () => {
    const manager = new PresetManager("test-presets", { seedFactoryPresets: false });
    const preset = makePreset("beta");

    const json = JSON.stringify(preset);
    manager.import(json);

    const exported = manager.export("beta");
    expect(JSON.parse(exported).name).toBe("beta");
  });

  it("seeds factory presets once and keeps custom presets", () => {
    const manager = new PresetManager("test-presets");
    const seeded = manager.list();

    expect(seeded.length).toBe(30);

    manager.save(makePreset("custom"));
    const withCustom = manager.list();
    expect(withCustom.length).toBe(31);
    expect(withCustom.some((preset) => preset.name === "custom")).toBe(true);

    const reopened = new PresetManager("test-presets");
    const reopenedList = reopened.list();
    expect(reopenedList.length).toBe(31);
    expect(reopenedList.filter((preset) => preset.name === "custom")).toHaveLength(1);
  });
});
