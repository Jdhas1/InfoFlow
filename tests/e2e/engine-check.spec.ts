import { expect, test } from "@playwright/test";

test("the sentence reader splits a typed action into its parts", async ({ page }) => {
  await page.goto("/");
  const input = page.getByTestId("reader-input");
  await input.fill("Sam types the PO number from the email into the job log");
  const result = page.getByTestId("reader-result");
  await expect(result).toContainText("Type / copy into");
  await expect(result).toContainText("Typed by hand");
  await expect(result).toContainText("the PO number");
  await expect(result).toContainText("the job log");
  await expect(page.getByTestId("reader-issue")).toHaveCount(0);

  await input.fill("Pat copies Price?");
  await expect(page.getByTestId("reader-issue")).toContainText("Missing: from where?, into where?, how?");
  await expect(result).toContainText("Yes (ends with ?)");
});

test("the sample map's gaps are listed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("sample-gaps")).toContainText("Possible duplicates");
  await expect(page.getByTestId("sample-summary")).toContainText("14 actions recorded");
});
