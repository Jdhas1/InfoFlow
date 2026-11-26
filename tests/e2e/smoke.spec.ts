import { expect, test } from "@playwright/test";

test("the built app opens and shows its version", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MAP INTAKE" })).toBeVisible();
  await expect(page.getByTestId("app-version").first()).toHaveText(/^Beta \d+\.\d+\.\d+/);
  expect(errors).toEqual([]);
});

test("fonts are bundled, with no requests to outside sites", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://localhost:4173")) outside.push(r.url());
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => document.fonts.check('700 44px "Barlow Condensed"'));
  expect(loaded).toBe(true);
  expect(outside).toEqual([]);
});
