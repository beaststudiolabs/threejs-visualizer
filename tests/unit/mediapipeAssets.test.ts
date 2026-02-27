import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const assetRoot = join(process.cwd(), "public", "mediapipe");
const wasmRoot = join(assetRoot, "wasm");

const assertNonEmptyFile = (path: string): void => {
  expect(existsSync(path)).toBe(true);
  const stats = statSync(path);
  expect(stats.isFile()).toBe(true);
  expect(stats.size).toBeGreaterThan(0);
};

describe("bundled mediapipe assets", () => {
  it("ships the local vision bundle and hand landmarker model", () => {
    assertNonEmptyFile(join(assetRoot, "vision_bundle.mjs"));
    assertNonEmptyFile(join(assetRoot, "hand_landmarker.task"));
  });

  it("ships required wasm runtime files", () => {
    assertNonEmptyFile(join(wasmRoot, "vision_wasm_internal.js"));
    assertNonEmptyFile(join(wasmRoot, "vision_wasm_internal.wasm"));
    assertNonEmptyFile(join(wasmRoot, "vision_wasm_nosimd_internal.js"));
    assertNonEmptyFile(join(wasmRoot, "vision_wasm_nosimd_internal.wasm"));
  });
});
