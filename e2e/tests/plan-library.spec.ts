import { authed, createUser, expect, expectAccessible, signIn, test } from "./fixtures";

test("Plan is in the sidebar and shows the food library with the user's foods first", async ({ page, request }) => {
  const u = await createUser(request);
  await authed(request, u.token).post("/food-entries", { date: "2026-09-29", meal: "breakfast", name: "Masala dosa", calories: 350, protein: 8, carbs: 50, fat: 12 });
  await signIn(page, u);
  await page.goto("/");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Plan" }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();

  const library = page.getByRole("complementary", { name: "Food library" });
  await expect(library.getByRole("region", { name: "Your foods" }).getByText("Masala dosa")).toBeVisible();
  await expect(library.getByRole("region", { name: "Suggested dishes" }).getByText(/idli/i).first()).toBeVisible();
  await expect(library.getByRole("heading", { name: "Tamil Nadu dishes" })).toBeVisible();

  // Search and meal filter narrow the list.
  await library.getByLabel("Search foods").fill("pongal");
  await expect(library.getByRole("listitem")).toHaveCount(2);
  await library.getByLabel("Clear search").click();
  await library.getByRole("button", { name: "Snacks" }).click();
  await expect(library.getByText("Masala dosa")).toHaveCount(0);

  await expect(page.getByRole("button", { name: /Build my own/ })).toBeVisible();
  await expectAccessible(page);
});

test("the week switcher moves between weeks and back to this week", async ({ page, request }) => {
  await signIn(page, await createUser(request));
  await page.goto("/plan");
  const label = page.getByText(/^Week of/).locator("..");
  const thisWeek = await label.textContent();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(label).not.toHaveText(thisWeek!);
  await page.getByRole("button", { name: "This week" }).click();
  await expect(label).toHaveText(thisWeek!);
});

test("on a phone, Plan is in the More sheet and the library opens as a sheet @phone", async ({ page, request }) => {
  await signIn(page, await createUser(request));
  await page.goto("/");
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("link", { name: /Plan/ }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await page.getByRole("button", { name: "Food library" }).click();
  const sheet = page.getByRole("dialog", { name: "Food library" });
  await expect(sheet.getByText(/idli/i).first()).toBeVisible();
  await expectAccessible(page);
});
