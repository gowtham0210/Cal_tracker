import { readFile } from "node:fs/promises";
import { createUser, expect, expectAccessible, planDay, signIn, test, thisWeek } from "./fixtures";

test("open the export sheet, preview it and download a PDF", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon] = thisWeek();
  await planDay(request, u, mon, [["breakfast", /^2 idli with sambar/, 1], ["lunch", /^Curd rice/, 1]]);
  await signIn(page, u);
  await page.goto("/plan");

  await page.getByRole("button", { name: "Export" }).click();
  const sheet = page.getByRole("dialog", { name: "Export PDF" });
  await expect(sheet.getByTitle("PDF preview")).toBeVisible();
  await sheet.getByRole("radio", { name: "This day" }).click();
  await sheet.getByRole("radiogroup", { name: "Day" }).getByRole("radio", { name: "Monday" }).click();
  await sheet.getByLabel("Include macros").check();
  await sheet.getByLabel(/Add grocery list/).check();
  await expect(sheet.getByTitle("PDF preview")).toBeVisible();
  await expectAccessible(page, { include: "[role=dialog]" });

  const [download] = await Promise.all([page.waitForEvent("download"), sheet.getByRole("button", { name: "Download PDF" }).click()]);
  expect(download.suggestedFilename()).toBe(`meal-plan-${mon}.pdf`);
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
});
