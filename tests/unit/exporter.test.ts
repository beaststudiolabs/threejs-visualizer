import { describe, expect, it } from "vitest";
import type { PresetV1 } from "../../src/contracts/types";
import { Exporter } from "../../src/export/Exporter";

const preset: PresetV1 = {
  version: 1,
  name: "sample",
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
    background: "#000",
    primary: "#fff",
    secondary: "#aaa",
    accent: "#0ff"
  },
  modulators: [],
  midiMappings: []
};

describe("Exporter", () => {
  it("exports expected files list", () => {
    const exporter = new Exporter();
    const manifest = exporter.exportProjectZip(preset);

    expect(manifest.files).toContain("README.md");
    expect(manifest.files).toContain("src/preset.json");
    expect(manifest.blob.size).toBeGreaterThan(0);
  });

  it("exports embed html", () => {
    const exporter = new Exporter();
    const html = exporter.exportEmbedHtml(preset);

    expect(html).toContain("VibeViz Embed");
    expect(html).toContain("sample");
  });
});
