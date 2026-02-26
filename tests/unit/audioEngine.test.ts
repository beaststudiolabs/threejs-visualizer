import { describe, expect, it } from "vitest";
import { AudioEngine } from "../../src/engines/AudioEngine";

describe("AudioEngine", () => {
  it("produces normalized values in mock mode", () => {
    const engine = new AudioEngine({ mock: true });

    for (let i = 0; i < 10; i += 1) {
      engine.update(1 / 60);
    }

    const features = engine.getFeatures();

    expect(features.rms).toBeGreaterThanOrEqual(0);
    expect(features.rms).toBeLessThanOrEqual(1);
    expect(features.bass).toBeGreaterThanOrEqual(0);
    expect(features.bass).toBeLessThanOrEqual(1);
  });
});
