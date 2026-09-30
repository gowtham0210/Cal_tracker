import { createUser, expect, expectAccessible, signIn, test } from "./fixtures";

// The E2E backend has the AI disabled; accepting suggestions is covered by the API tests.
test("the Try new tab explains when suggestions aren't available", async ({ page, request }) => {
  const u = await createUser(request);
  await signIn(page, u);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Build my own" }).click();
  await page.getByRole("button", { name: "Food library" }).click();
  const library = page.getByRole("complementary", { name: "Food library" });
  await library.getByRole("radio", { name: "Try new" }).click();
  await expect(library).toContainText("No new foods yet");
  await library.getByRole("button", { name: "Suggest foods to try" }).click();
  await expect(library.getByRole("alert")).toContainText(/AI features are unavailable/);
  await expectAccessible(page);
});

test("review a suggestion, correct its calories and add it to the library", async ({ page, request }) => {
  const u = await createUser(request);
  // Only the AI call is stubbed; saving goes to the real API.
  await page.route("**/food-library/suggestions", (route) =>
    route.fulfill({
      json: {
        data: [
          { name: "Ragi idiyappam", meal: "breakfast", serving: "3 pieces", calories: 240, protein: 5, carbs: 50, fat: 2, confidence: "medium", cuisine: "tamil-nadu", diet: "veg", allergens: [], basedOn: "2 idli with sambar & tomato chutney", reason: "Steamed, with millet" },
        ],
      },
    }),
  );
  await signIn(page, u);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Build my own" }).click();
  await page.getByRole("button", { name: "Food library" }).click();
  const library = page.getByRole("complementary", { name: "Food library" });
  await library.getByRole("radio", { name: "Try new" }).click();
  await library.getByRole("button", { name: "Suggest foods to try" }).click();

  await expect(library).toContainText("You eat 2 idli with sambar & tomato chutney, so try this.");
  await expect(library).toContainText("Medium confidence");
  await library.getByRole("button", { name: "Review Ragi idiyappam" }).click();
  await library.getByLabel("Calories").fill("260");
  await expectAccessible(page);
  await library.getByRole("button", { name: "Save to library" }).click();

  await expect(page.getByText("Added Ragi idiyappam to your library")).toBeVisible();
  await expect(library.getByRole("button", { name: /^Ragi idiyappam, 3 pieces, 260 kcal/ })).toBeVisible();
});
