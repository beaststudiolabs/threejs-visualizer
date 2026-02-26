import { expect, test } from "@playwright/test";

test("export: zip click triggers download", async ({ page }) => {
  await page.goto("/");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-zip").click()
  ]);

  expect(download.suggestedFilename()).toContain(".zip");
});
