import { expect, test } from "@playwright/test";

test.describe("visual snapshots", () => {
  test("snapshot particle wizard", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/?testMode=1&seed=1337&t=1&width=1280&height=720", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(250);

    await expect(page.getByTestId("wizard-canvas")).toHaveScreenshot("particle-wizard.png", {
      maxDiffPixelRatio: 0.02
    });
  });
});
