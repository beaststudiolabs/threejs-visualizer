import { expect, test } from "@playwright/test";

test("smoke: renders canvas and supports dock toggles", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("viz-canvas")).toBeVisible();
  await expect(page.getByTestId("dock-left")).toBeVisible();

  await page.getByTestId("toggle-left").click();
  await page.getByTestId("toggle-left").click();

  await expect(page.getByTestId("canvas-shell")).toBeVisible();
});
