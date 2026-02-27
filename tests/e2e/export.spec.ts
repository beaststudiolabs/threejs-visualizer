import { expect, test } from "@playwright/test";

test("wizard controls: transform cycles mode and mic can activate", async ({ page }) => {
  await page.goto("/?testMode=1", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("mode-value")).toHaveText("SPHERICAL");
  await page.getByTestId("transform-btn").click();
  await expect(page.getByTestId("mode-value")).toHaveText("MOBIUS");

  await page.getByTestId("mic-btn").click();
  await expect(page.getByTestId("mic-btn")).toHaveAttribute("data-mic-status", "active");
});
