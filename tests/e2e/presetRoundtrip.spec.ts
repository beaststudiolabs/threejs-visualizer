import { expect, test } from "@playwright/test";

test("preset roundtrip: save and load preset", async ({ page }) => {
  await page.goto("/");

  await page.fill("#preset-name", "e2e-sample");
  await page.getByTestId("preset-save").click();

  await expect(page.getByTestId("preset-list")).toContainText("e2e-sample");
});
