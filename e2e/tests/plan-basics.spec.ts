import { createUser, expect, expectAccessible, signIn, test } from "./fixtures";

test("build a day by hand: add a food, change its portion, and see totals and status update", async ({ page, request }) => {
  await signIn(page, await createUser(request));
  await page.goto("/plan");
  await page.getByRole("button", { name: /Build my own/ }).click();

  await page.getByRole("button", { name: /Add food to breakfast on Monday/ }).click();
  const sheet = page.getByRole("dialog", { name: "Add to breakfast" });
  await sheet.getByRole("button", { name: /^Add 2 idli with sambar/ }).click();
  await sheet.getByRole("button", { name: "Done" }).click();

  const monday = page.getByRole("columnheader").filter({ hasText: /^Mon/ });
  await expect(monday).toContainText("270 kcal");
  await expect(monday).toContainText("1,630"); // 1900 − 270, shown as "↓ 1,630 under"
  await expect(page.getByText("Saved")).toBeVisible();

  await page.getByRole("button", { name: /2 idli with sambar.*Change portion/ }).click();
  const portion = page.getByRole("dialog", { name: /2 idli with sambar/ });
  await portion.getByRole("group", { name: "Quick portions" }).getByRole("button", { name: "2" }).click();
  await expect(portion.getByText("540")).toBeVisible();
  await expectAccessible(page);
  await portion.getByRole("button", { name: "Done" }).click();
  await expect(monday).toContainText("540 kcal");

  // Saved on the server: a reload shows the same plan.
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("columnheader").filter({ hasText: /^Mon/ })).toContainText("540 kcal");
  await expect(page.getByRole("region", { name: "Week summary" })).toContainText("540");
  await expectAccessible(page);
});

test("remove a planned food from its portion sheet", async ({ page, request }) => {
  await signIn(page, await createUser(request));
  await page.goto("/plan");
  await page.getByRole("button", { name: /Build my own/ }).click();
  await page.getByRole("button", { name: /Add food to lunch on Tuesday/ }).click();
  await page.getByRole("dialog", { name: "Add to lunch" }).getByRole("button", { name: /^Add Curd rice/ }).click();
  await page.getByRole("dialog", { name: "Add to lunch" }).getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: /Curd rice.*Change portion/ }).click();
  await page.getByRole("dialog", { name: /Curd rice/ }).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("button", { name: /Curd rice.*Change portion/ })).toHaveCount(0);
});

test("on a phone, plan one day at a time with day chips @phone", async ({ page, request }) => {
  await signIn(page, await createUser(request));
  await page.goto("/plan");
  await page.getByRole("button", { name: /Build my own/ }).click();

  const days = page.getByRole("tablist", { name: "Days of the week" });
  await days.getByRole("tab").nth(2).click(); // Wednesday
  await expect(page.getByRole("tabpanel")).toContainText("Wednesday");

  await page.getByRole("region", { name: "Snacks" }).getByRole("button", { name: /Add food to snacks/ }).click();
  const sheet = page.getByRole("dialog", { name: "Add to snacks" });
  await sheet.getByRole("button", { name: /^Add Channa sundal/ }).click();
  await sheet.getByRole("button", { name: "Done" }).click();

  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("210 of 1,900 kcal");
  await expect(panel).toContainText("1,690 under");
  await expect(days.getByRole("tab").nth(2)).toHaveAccessibleName(/under goal/);
  await expectAccessible(page);
});
