import { expect, expectAccessible, test } from "./fixtures";

test("a new user registers, sets goals and lands on the dashboard @mobile", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Meena Test");
  await page.getByLabel("Email").fill(`smoke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Height").fill("165");
  await page.getByLabel("Current weight").fill("70");
  await page.getByLabel("Goal weight").fill("62");
  await page.getByRole("button", { name: "Start tracking" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meena");
  await expectAccessible(page);
});
