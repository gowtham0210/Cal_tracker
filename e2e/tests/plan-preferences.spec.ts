import { authed, createUser, expect, expectAccessible, planDay, signIn, test, thisWeek } from "./fixtures";

test("set diet type, allergies and budget in Settings, and they stay set", async ({ page, request }) => {
  const u = await createUser(request);
  await signIn(page, u);
  await page.goto("/settings");

  const card = page.getByRole("region", { name: "Food preferences" });
  await card.getByRole("radiogroup", { name: "Diet type" }).getByRole("radio", { name: "Eggetarian" }).click();
  await card.getByRole("button", { name: "Peanut", exact: true }).click();
  await card.getByLabel("Other allergy").fill("Brinjal");
  await card.getByLabel("Other allergy").press("Enter");
  await expect(card.getByRole("button", { name: "Remove brinjal" })).toBeVisible();
  await card.getByRole("radiogroup", { name: "Budget" }).getByRole("radio", { name: "Daily amount" }).click();
  await card.getByLabel("Daily budget").fill("300");
  await card.getByLabel("Daily budget").blur();
  await expectAccessible(page);

  await expect.poll(async () => (await (await authed(request, u.token).get("/me/profile")).json()).dailyBudget).toBe(300);
  await page.reload();
  await expect(card.getByRole("radio", { name: "Eggetarian" })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByRole("button", { name: "Peanut", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(card.getByRole("button", { name: "Remove brinjal" })).toBeVisible();
  await expect(card.getByLabel("Daily budget")).toHaveValue("300");
});

test("foods that conflict with an allergy are flagged in the plan and the library", async ({ page, request }) => {
  const u = await createUser(request);
  await authed(request, u.token).patch("/me/profile", { allergies: ["peanut"] });
  await planDay(request, u, thisWeek()[0], [["snack", /^Apple with 1 tbsp peanut butter/, 1], ["breakfast", /^2 idli with sambar/, 1]]);
  await signIn(page, u);
  await page.goto("/plan");

  await expect(page.getByRole("button", { name: /^Apple with 1 tbsp peanut butter.*Contains peanut/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^2 idli with sambar/ })).not.toHaveAccessibleName(/Contains/);

  await page.getByRole("button", { name: "Food library" }).click();
  const library = page.getByRole("complementary", { name: "Food library" });
  await library.getByRole("searchbox", { name: "Search foods" }).fill("peanut");
  await expect(library.getByRole("listitem").filter({ hasText: /Apple with 1 tbsp peanut butter/ })).toContainText("Contains peanut");
  await expectAccessible(page);

  await page.getByRole("button", { name: /^Apple with 1 tbsp peanut butter.*Change portion/ }).press("Enter");
  await expect(page.getByRole("dialog")).toContainText("Contains peanut");
});
