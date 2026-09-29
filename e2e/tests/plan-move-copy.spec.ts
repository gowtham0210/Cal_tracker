import { createUser, expect, expectAccessible, planDay, signIn, test, thisWeek } from "./fixtures";

const IDLI = /^2 idli with sambar/;
const SUNDAL = /^Channa sundal/;
const header = (page: import("@playwright/test").Page, day: string) => page.getByRole("columnheader").filter({ hasText: new RegExp(`^${day}`) });

test("copy a day to two other days, then undo", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon] = thisWeek();
  await planDay(request, u, mon, [["breakfast", IDLI, 1], ["snack", SUNDAL, 1]]);
  await signIn(page, u);
  await page.goto("/plan");

  await page.getByRole("button", { name: "Monday actions" }).click();
  await page.getByRole("menuitem", { name: "Copy day to…" }).click();
  const sheet = page.getByRole("dialog", { name: "Copy Monday to…" });
  await sheet.getByLabel(/Tuesday/).check();
  await sheet.getByLabel(/Wednesday/).check();
  await expectAccessible(page);
  await sheet.getByRole("button", { name: "Copy to 2 days" }).click();

  await expect(header(page, "Tue")).toContainText("480 kcal");
  await expect(header(page, "Wed")).toContainText("480 kcal");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(header(page, "Tue")).toContainText("—");
  await expect(header(page, "Wed")).toContainText("—");
  await expect(header(page, "Mon")).toContainText("480 kcal");

  // Undo was saved: a reload shows the restored plan.
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(header(page, "Tue")).toContainText("—");
});

test("replace is only offered when a target day already has food", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon, tue] = thisWeek();
  await planDay(request, u, mon, [["breakfast", IDLI, 1]]);
  await planDay(request, u, tue, [["snack", SUNDAL, 2]]);
  await signIn(page, u);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Monday actions" }).click();
  await page.getByRole("menuitem", { name: "Copy day to…" }).click();
  const sheet = page.getByRole("dialog", { name: "Copy Monday to…" });
  await sheet.getByLabel(/Wednesday/).check();
  await expect(sheet.getByRole("radiogroup", { name: "When a day already has food" })).toHaveCount(0);
  await sheet.getByLabel(/Tuesday/).check();
  await sheet.getByRole("radio", { name: "Replace it" }).click();
  await sheet.getByRole("button", { name: "Copy to 2 days" }).click();
  await expect(header(page, "Tue")).toContainText("270 kcal");
});

test("move a food to another day and meal from its sheet, then undo", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon] = thisWeek();
  await planDay(request, u, mon, [["breakfast", IDLI, 1]]);
  await signIn(page, u);
  await page.goto("/plan");

  await page.getByRole("button", { name: /2 idli with sambar.*Change portion/ }).click();
  await page.getByRole("button", { name: "Move to…" }).click();
  const sheet = page.getByRole("dialog", { name: "Move to…" });
  await sheet.getByRole("radio", { name: "Thursday" }).click();
  await sheet.getByRole("radio", { name: "Dinner" }).click();
  await sheet.getByRole("button", { name: "Move to Thu dinner" }).click();

  await expect(header(page, "Thu")).toContainText("270 kcal");
  await expect(header(page, "Mon")).toContainText("—");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(header(page, "Mon")).toContainText("270 kcal");
  await expect(header(page, "Thu")).toContainText("—");
});

test("day menus work with the keyboard", async ({ page, request }) => {
  const u = await createUser(request);
  await planDay(request, u, thisWeek()[0], [["breakfast", IDLI, 1]]);
  await signIn(page, u);
  await page.goto("/plan");
  const button = page.getByRole("button", { name: "Monday actions" });
  await button.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Copy day to…" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Clear day" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("on a phone, clear a day from its menu and undo @phone", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon] = thisWeek();
  await planDay(request, u, mon, [["lunch", /^Curd rice/, 1]]);
  await signIn(page, u);
  await page.goto("/plan");
  await page.getByRole("tablist", { name: "Days of the week" }).getByRole("tab").first().click();
  await page.getByRole("button", { name: /actions$/ }).click();
  await page.getByRole("menuitem", { name: "Clear day" }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("0 of 1,900 kcal");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(panel).toContainText("280 of 1,900 kcal");
  await expectAccessible(page);
});
