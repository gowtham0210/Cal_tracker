import type { Page } from "@playwright/test";
import { createUser, expect, expectAccessible, planDay, signIn, test, thisWeek } from "./fixtures";

// The E2E backend runs with the AI disabled, so drafts are built by rules.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const header = (page: Page, day: string) => page.getByRole("columnheader").filter({ hasText: new RegExp(`^${day}`) });

test("generate a week with the AI unavailable, then keep it", async ({ page, request }) => {
  const u = await createUser(request);
  await signIn(page, u);
  await page.goto("/plan");
  await page.getByRole("button", { name: /Generate with AI/ }).click();

  const sheet = page.getByRole("dialog", { name: "Plan with AI" });
  await expect(sheet.getByRole("radio", { name: "Whole week" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByRole("radio", { name: "Mostly my usual foods" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet).toContainText("Tamil Nadu");
  await expect(sheet).toContainText("No allergies");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: "Generate week" }).click();

  const banner = page.getByRole("region", { name: "Draft plan" });
  await expect(banner).toContainText(/simple rules/i);
  for (const d of DAYS) await expect(header(page, d)).toContainText("kcal");
  await expect(banner.getByText(/Built from \d+ foods/)).toBeVisible();
  await expectAccessible(page);

  await banner.getByRole("button", { name: "Keep" }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(header(page, "Mon")).toContainText("kcal");
  await expect(page.getByRole("region", { name: "Draft plan" })).toHaveCount(0);
});

test("regenerate a planned day, edit a preference in place, then discard to get the old day back", async ({ page, request }) => {
  const u = await createUser(request);
  await planDay(request, u, thisWeek()[0], [["breakfast", /^2 idli with sambar/, 1]]);
  await signIn(page, u);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Generate", exact: true }).click();

  const sheet = page.getByRole("dialog", { name: "Plan with AI" });
  await sheet.getByRole("radio", { name: "One day" }).click();
  await sheet.getByRole("radiogroup", { name: "Day" }).getByRole("radio", { name: "Monday" }).click();
  await sheet.getByRole("button", { name: "Change" }).click();
  await sheet.getByRole("radiogroup", { name: "Diet type" }).getByRole("radio", { name: "Veg", exact: true }).click();
  await expect(sheet).toContainText("Your current plan stays until you keep the draft");
  await sheet.getByRole("button", { name: "Generate Monday" }).click();

  const banner = page.getByRole("region", { name: "Draft plan" });
  await expect(banner).toContainText(/simple rules/i);
  await expect(header(page, "Mon")).not.toContainText("270 kcal");
  await expect(header(page, "Mon")).toContainText("On target");
  await expect(header(page, "Tue")).toContainText("—");

  await banner.getByRole("button", { name: "Discard" }).click();
  await expect(banner).toHaveCount(0);
  await expect(header(page, "Mon")).toContainText("270 kcal");
});
