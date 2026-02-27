import { expect, test } from "@playwright/test";

test("smoke: renders wizard canvas and control HUD", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?testMode=1", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("wizard-canvas")).toBeVisible();
  await expect(page.getByTestId("hud-root")).toBeVisible();
  await expect(page.getByTestId("advanced-panel")).toBeVisible();
  await expect(page.getByTestId("webcam-container")).toBeVisible();
  await expect(page.getByTestId("debug-panel")).toBeVisible();
  await expect(page.getByTestId("title-text")).toHaveText("PARTICLE WIZARD");
  await expect(page.getByTestId("transform-btn")).toBeVisible();
  await expect(page.getByTestId("flow-btn")).toBeVisible();
  await expect(page.getByTestId("trails-btn")).toBeVisible();
  await expect(page.getByTestId("mic-btn")).toBeVisible();
  await expect(page.getByTestId("fullscreen-btn")).toBeVisible();
  await expect(page.getByTestId("fps-slider")).toBeVisible();
  await expect(page.getByTestId("particle-slider")).toBeVisible();
  await expect(page.locator("#debug-panel")).toContainText("Shared:");

  const webcamBox = await page.getByTestId("webcam-container").boundingBox();
  const debugBox = await page.getByTestId("debug-panel").boundingBox();
  const advancedBox = await page.getByTestId("advanced-panel").boundingBox();

  expect(webcamBox).not.toBeNull();
  expect(debugBox).not.toBeNull();
  expect(advancedBox).not.toBeNull();

  if (webcamBox && debugBox && advancedBox) {
    expect(webcamBox.x).toBeLessThan(90);
    expect(debugBox.x).toBeGreaterThan(720);
    expect(advancedBox.x).toBeGreaterThan(720);
    expect(advancedBox.y).toBeLessThan(90);
  }

  await page.getByTestId("flow-btn").click();
  await expect(page.getByTestId("flow-btn")).toHaveAttribute("data-active", "false");

  await page.getByTestId("trails-btn").click();
  await expect(page.getByTestId("trails-btn")).toHaveAttribute("data-active", "false");
  await expect(page.getByTestId("trails-value")).toHaveText("OFF");

  await page.getByTestId("transform-btn").click();
  await expect(page.getByTestId("mode-value")).toHaveText("MOBIUS");
  await expect(page.getByTestId("title-text")).toHaveText("PARTICLE WIZARD");
});
