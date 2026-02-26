import { describe, expect, it } from "vitest";
import { MidiEngine } from "../../src/engines/MidiEngine";

describe("MidiEngine", () => {
  it("normalizes injected CC values", () => {
    const engine = new MidiEngine();
    engine.setMockEnabled(true);
    engine.injectMockCC(48, 1.2, 1234);

    const state = engine.getState();
    expect(state.cc[48]).toBe(1);
    expect(state.last?.cc).toBe(48);
  });
});
