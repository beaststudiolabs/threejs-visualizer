import { describe, expect, it } from "vitest";
import { WebcamEngine } from "../../src/engines/WebcamEngine";

describe("WebcamEngine", () => {
  it("supports deterministic mock intensity", () => {
    const engine = new WebcamEngine();
    engine.setMockEnabled(true);
    engine.injectMockIntensity(0.4);

    const state = engine.getState();
    expect(state.enabled).toBe(true);
    expect(state.intensity).toBeCloseTo(0.4, 4);
  });
});
