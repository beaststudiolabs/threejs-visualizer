import { expect, test } from "@playwright/test";

test("smoke: renders wizard canvas and control HUD", async ({ page }) => {
  await page.goto("/?testMode=1", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("wizard-canvas")).toBeVisible();
  await expect(page.getByTestId("hud-root")).toBeVisible();
  await expect(page.getByTestId("transform-btn")).toBeVisible();
  await expect(page.getByTestId("flow-btn")).toBeVisible();
  await expect(page.getByTestId("trails-btn")).toBeVisible();
  await expect(page.getByTestId("mic-btn")).toBeVisible();

  await page.getByTestId("flow-btn").click();
  await expect(page.getByTestId("flow-btn")).toHaveAttribute("data-active", "false");

  await page.getByTestId("trails-btn").click();
  await expect(page.getByTestId("trails-btn")).toHaveAttribute("data-active", "false");
  await expect(page.getByTestId("trails-value")).toHaveText("OFF");
});
