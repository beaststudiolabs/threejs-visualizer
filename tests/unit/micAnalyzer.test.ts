import { describe, expect, it } from "vitest";
import { MicAnalyzer } from "../../src/wizard/MicAnalyzer";

describe("MicAnalyzer", () => {
  it("supports start/stop toggling in test mode", async () => {
    const mic = new MicAnalyzer(true);

    const activeStatus = await mic.start();
    expect(activeStatus).toBe("active");
    expect(mic.isActive()).toBe(true);

    mic.stop();
    expect(mic.getStatus()).toBe("idle");
    expect(mic.isActive()).toBe(false);
  });

  it("applies clamped sensitivity scaling", async () => {
    const baseMic = new MicAnalyzer(true);
    const highMic = new MicAnalyzer(true);
    await baseMic.start();
    await highMic.start();

    baseMic.setSensitivity(1);
    highMic.setSensitivity(8);
    expect(highMic.getSensitivity()).toBe(3);

    const baseLevel = baseMic.update(1 / 60, 1);
    const highLevel = highMic.update(1 / 60, 1);
    expect(highLevel).toBeGreaterThan(baseLevel);
  });
});
