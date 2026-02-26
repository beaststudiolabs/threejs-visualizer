import { expect, test } from "@playwright/test";

const templates = ["wireframeBlob", "spiroRing", "pointCloudOrb"];

test.describe("visual snapshots", () => {
  for (const template of templates) {
    test(`snapshot ${template}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(`/?testMode=1&template=${template}&seed=1337&loop=4&t=1&width=1280&height=720`);

      const canvas = page.getByTestId("viz-canvas");
      await expect(canvas).toBeVisible({ timeout: 15000 });

      const screenshot = await canvas.screenshot();
      expect(screenshot).toMatchSnapshot(`${template}.png`, {
        maxDiffPixelRatio: 0.02
      });
    });
  }
});
