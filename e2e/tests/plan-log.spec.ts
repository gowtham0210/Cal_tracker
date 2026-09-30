import { createUser, expect, expectAccessible, planDay, signIn, test } from "./fixtures";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test("log a planned meal from the dashboard and see it in the food log @mobile", async ({ page, request }) => {
  const u = await createUser(request);
  await planDay(request, u, today(), [["breakfast", /^2 idli with sambar/, 1.5], ["lunch", /^Curd rice/, 1]]);
  await signIn(page, u);
  await page.goto("/");

  const card = page.getByRole("region", { name: "Today's plan" });
  await expect(card).toContainText("405 kcal");
  await expectAccessible(page);
  await card.getByRole("button", { name: "Log breakfast from your plan" }).click();
  await expect(page.getByText(/Logged breakfast from your plan \(405 kcal\)/)).toBeVisible();
  await expect(card).toContainText("Logged");
  await expect(card.getByRole("button", { name: "Log lunch from your plan" })).toBeVisible();

  await page.goto("/food");
  const entry = page.getByText("2 idli with sambar & tomato chutney");
  await expect(entry).toBeVisible();
  await expect(page.getByText("From plan")).toBeVisible();
  await expect(page.getByText("405", { exact: false }).first()).toBeVisible();
});

test("log the planned meal from Quick add's From plan tab", async ({ page, request }) => {
  const u = await createUser(request);
  await planDay(request, u, today(), [["dinner", /^Chicken chettinad/, 1]]);
  await signIn(page, u);
  await page.goto("/food");
  await page.getByRole("button", { name: /Quick add/ }).first().click();
  await page.getByRole("button", { name: /^Food/ }).click();
  const sheet = page.getByRole("dialog", { name: "Log food" });
  await sheet.getByRole("radio", { name: /Dinner/ }).click();
  await sheet.getByRole("tab", { name: /From plan/ }).click();
  await expect(sheet).toContainText("Chicken chettinad with 1 cup rice");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: /^Log dinner/ }).click();
  await expect(page.getByText(/Logged dinner from your plan/)).toBeVisible();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByText("Chicken chettinad with 1 cup rice").first()).toBeVisible();
});
