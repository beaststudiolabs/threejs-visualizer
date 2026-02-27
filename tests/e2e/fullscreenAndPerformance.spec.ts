import { expect, test } from "@playwright/test";

test("wizard hotkeys and performance controls", async ({ page }) => {
  await page.goto("/?testMode=1&debug=0", { waitUntil: "domcontentloaded" });

  const hud = page.getByTestId("hud-root");
  const webcam = page.getByTestId("webcam-container");
  const status = page.getByTestId("status-line");

  await expect(hud).toBeVisible();
  await expect(webcam).toBeVisible();
  await expect(status).toBeVisible();

  await page.keyboard.press("m");
  await expect(hud).toBeHidden();
  await expect(webcam).toBeHidden();
  await expect(status).toBeHidden();

  await page.keyboard.press("m");
  await expect(hud).toBeVisible();
  await expect(webcam).toBeVisible();
  await expect(status).toBeVisible();

  await page.getByTestId("fullscreen-btn").click();
  await expect.poll(async () => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect(hud).toBeHidden();
  await expect(webcam).toBeHidden();
  await expect(status).toBeHidden();

  await page.keyboard.press("f");
  await expect.poll(async () => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await expect(hud).toBeVisible();
  await expect(webcam).toBeVisible();
  await expect(status).toBeVisible();

  const setRangeValue = async (testId: string, value: number): Promise<void> => {
    await page.getByTestId(testId).evaluate((element, nextValue) => {
      const input = element as HTMLInputElement;
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      descriptor?.set?.call(input, String(nextValue));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };

  await setRangeValue("fps-slider", 240);
  await expect(page.getByTestId("fps-slider")).toHaveValue("240");
  await expect(page.getByTestId("fps-cap-value")).toHaveText("240");

  await setRangeValue("particle-slider", 1000);
  await expect(page.getByTestId("particle-slider")).toHaveValue("1000");
  await expect(page.locator("#particle-count")).toHaveText("1000");

  await setRangeValue("particle-slider", 100000);
  await expect(page.getByTestId("particle-slider")).toHaveValue("100000");
  await expect(page.locator("#particle-count")).toHaveText("100000");
});
