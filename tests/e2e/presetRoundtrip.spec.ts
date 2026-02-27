import { expect, test } from "@playwright/test";

test("wizard toggles: flow and trails update HUD state", async ({ page }) => {
  await page.goto("/?testMode=1", { waitUntil: "domcontentloaded" });

  const flowButton = page.getByTestId("flow-btn");
  const trailsButton = page.getByTestId("trails-btn");

  await expect(flowButton).toHaveAttribute("data-active", "true");
  await expect(trailsButton).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("trails-value")).toHaveText("ACTIVE");

  await flowButton.click();
  await trailsButton.click();

  await expect(flowButton).toHaveAttribute("data-active", "false");
  await expect(trailsButton).toHaveAttribute("data-active", "false");
  await expect(page.getByTestId("trails-value")).toHaveText("OFF");
});
