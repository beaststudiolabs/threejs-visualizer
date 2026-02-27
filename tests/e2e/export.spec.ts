import { expect, test } from "@playwright/test";

test("wizard controls: transform cycles mode and mic can activate", async ({ page }) => {
  await page.goto("/?testMode=1", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("title-text")).toHaveText("PARTICLE WIZARD");
  await expect(page.getByTestId("mode-value")).toHaveText("SPHERICAL");
  await page.getByTestId("transform-btn").click();
  await expect(page.getByTestId("title-text")).toHaveText("PARTICLE WIZARD");
  await expect(page.getByTestId("mode-value")).toHaveText("MOBIUS");

  const modeSelect = page.getByTestId("mode-select");
  await expect(modeSelect.locator("option")).toHaveCount(11);
  await modeSelect.selectOption({ label: "PARTICLE HANDS" });
  await expect(page.getByTestId("mode-value")).toHaveText("PARTICLE HANDS");
  await page.getByTestId("transform-btn").click();
  await expect(page.getByTestId("mode-value")).toHaveText("SPHERICAL");
  await modeSelect.selectOption({ label: "PARTICLE HANDS" });
  await expect(page.getByTestId("mode-value")).toHaveText("PARTICLE HANDS");
  await page.getByTestId("transform-btn").click();
  await expect(page.getByTestId("mode-value")).toHaveText("SPHERICAL");

  const backgroundButton = page.getByTestId("background-btn");
  await expect(backgroundButton).toHaveAttribute("data-active", "true");
  await backgroundButton.click();
  await expect(backgroundButton).toHaveAttribute("data-active", "false");
  await backgroundButton.click();
  await expect(backgroundButton).toHaveAttribute("data-active", "true");

  await backgroundButton.dispatchEvent("pointerdown", {
    pointerType: "mouse",
    pointerId: 7,
    button: 0,
    clientX: 24,
    clientY: 24
  });
  await page.waitForTimeout(360);
  await backgroundButton.dispatchEvent("pointerup", {
    pointerType: "mouse",
    pointerId: 7,
    button: 0,
    clientX: 24,
    clientY: 24
  });

  const backgroundColorInput = page.getByTestId("background-color-input");
  await expect(backgroundColorInput).toBeVisible();
  await expect(backgroundButton).toHaveAttribute("data-active", "true");
  await backgroundColorInput.evaluate((node) => {
    const input = node as HTMLInputElement;
    input.value = "#112233";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(backgroundColorInput).toHaveValue("#112233");

  const micButton = page.getByTestId("mic-btn");
  await micButton.click();
  await expect(micButton).toHaveAttribute("data-mic-status", "active");
  await micButton.click();
  await expect(micButton).toHaveAttribute("data-mic-status", "idle");

  await micButton.dispatchEvent("pointerdown", {
    pointerType: "mouse",
    pointerId: 1,
    button: 0,
    clientX: 24,
    clientY: 24
  });
  await page.waitForTimeout(360);
  await micButton.dispatchEvent("pointerup", {
    pointerType: "mouse",
    pointerId: 1,
    button: 0,
    clientX: 24,
    clientY: 24
  });

  const micSlider = page.getByTestId("mic-sensitivity-slider");
  await expect(micSlider).toBeVisible();
  await micSlider.evaluate((node) => {
    const input = node as HTMLInputElement;
    input.value = "2.5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(micSlider).toHaveValue("2.5");

  const primaryColor = page.getByTestId("primary-color-input");
  await primaryColor.evaluate((node) => {
    const input = node as HTMLInputElement;
    input.value = "#ff3366";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(primaryColor).toHaveValue("#ff3366");
});
