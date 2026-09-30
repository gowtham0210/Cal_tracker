import { createUser, expect, expectAccessible, planDay, signIn, test, thisWeek } from "./fixtures";

test("swap a planned food for a similar one, then undo", async ({ page, request }) => {
  const u = await createUser(request);
  await planDay(request, u, thisWeek()[0], [["breakfast", /^2 idli with sambar/, 1]]);
  await signIn(page, u);
  await page.goto("/plan");

  await page.getByRole("button", { name: /^2 idli with sambar.*Change portion/ }).click();
  await page.getByRole("button", { name: "Swap" }).click();
  const sheet = page.getByRole("dialog", { name: /Swap 2 idli with sambar/ });
  const options = sheet.getByRole("button", { name: /kcal/ });
  await expect(options.first()).toBeVisible();
  expect(await options.count()).toBeGreaterThanOrEqual(3);
  await expect(sheet).toContainText(/Similar foods from your library/);
  await expectAccessible(page);

  const name = (await options.first().getAttribute("data-food-name"))!;
  await options.first().click();
  await expect(page.getByRole("button", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*Change portion`) })).toBeVisible();
  await expect(page.getByText(/^Swapped 2 idli with sambar/)).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: /^2 idli with sambar.*Change portion/ })).toBeVisible();
});
