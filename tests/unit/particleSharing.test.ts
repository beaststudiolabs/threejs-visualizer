import { describe, expect, it } from "vitest";
import { resolveSharedParticleAssignment } from "../../src/wizard/math";

const buildCounts = (count: number, sharedRatio: number): { leftVisible: number; rightVisible: number; shared: number } => {
  let leftVisible = 0;
  let rightVisible = 0;
  let shared = 0;

  for (let i = 0; i < count; i += 1) {
    const seed = (i + 0.5) / count;
    const assignment = resolveSharedParticleAssignment(seed, sharedRatio);
    if (assignment === "shared") {
      leftVisible += 1;
      rightVisible += 1;
      shared += 1;
    } else if (assignment === "left") {
      leftVisible += 1;
    } else {
      rightVisible += 1;
    }
  }

  return { leftVisible, rightVisible, shared };
};

describe("particle sharing distribution", () => {
  it("drives full overlap when models are near", () => {
    const counts = buildCounts(12000, 1);
    expect(counts.shared).toBe(12000);
    expect(counts.leftVisible).toBe(12000);
    expect(counts.rightVisible).toBe(12000);
  });

  it("drives strict split when models are far", () => {
    const counts = buildCounts(12000, 0);
    expect(counts.shared).toBe(0);
    expect(counts.leftVisible + counts.rightVisible).toBe(12000);
    expect(Math.abs(counts.leftVisible - counts.rightVisible)).toBeLessThanOrEqual(1);
  });

  it("de-randomizes visible share count near midpoint", () => {
    const sharedRatio = 0.5;
    const counts = buildCounts(12000, sharedRatio);
    const expectedShared = 6000;
    const expectedExclusivePerSide = 3000;

    expect(counts.shared).toBe(expectedShared);
    expect(counts.leftVisible - expectedShared).toBeGreaterThanOrEqual(expectedExclusivePerSide - 1);
    expect(counts.leftVisible - expectedShared).toBeLessThanOrEqual(expectedExclusivePerSide + 1);
    expect(counts.rightVisible - expectedShared).toBeGreaterThanOrEqual(expectedExclusivePerSide - 1);
    expect(counts.rightVisible - expectedShared).toBeLessThanOrEqual(expectedExclusivePerSide + 1);
  });
});
