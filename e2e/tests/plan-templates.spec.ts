import type { Page } from "@playwright/test";
import { createUser, expect, expectAccessible, planDay, signIn, test, thisWeek } from "./fixtures";

const header = (page: Page, day: string) => page.getByRole("columnheader").filter({ hasText: new RegExp(`^${day}`) });

test("save a week as a template, start next week from it, then undo", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon, , wed] = thisWeek();
  await planDay(request, u, mon, [["breakfast", /^2 idli with sambar/, 1], ["lunch", /^Curd rice/, 1]]);
  await planDay(request, u, wed, [["dinner", /^Egg curry/, 1]]);
  await signIn(page, u);
  await page.goto("/plan");

  await page.getByRole("button", { name: "Templates" }).click();
  const sheet = page.getByRole("dialog", { name: "Templates" });
  await expect(sheet.getByLabel("Save this week as")).not.toHaveValue("");
  await sheet.getByLabel("Save this week as").fill("My usual week");
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText('Saved "My usual week"')).toBeVisible();
  await expect(sheet.getByRole("list", { name: "Your templates" })).toContainText("My usual week");
  await expect(sheet).toContainText("2 days");
  await expectAccessible(page);
  await sheet.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Next week" }).click();
  await page.getByRole("button", { name: /Start from a template/ }).click();
  await sheet.getByRole("button", { name: "Apply My usual week" }).click();
  await expect(sheet.getByRole("radio", { name: "Replace the week" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("button", { name: "Apply to this week" }).click();

  await expect(header(page, "Mon")).toContainText("550 kcal");
  await expect(header(page, "Wed")).not.toContainText("—");
  await expect(header(page, "Tue")).toContainText("—");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(header(page, "Mon")).toContainText("—");
  await expect(header(page, "Wed")).toContainText("—");
});
