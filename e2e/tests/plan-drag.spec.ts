import type { Locator, Page } from "@playwright/test";
import { createUser, expect, expectAccessible, planDay, signIn, test, thisWeek } from "./fixtures";

const IDLI = /^2 idli with sambar/;
const header = (page: Page, day: string) => page.getByRole("columnheader").filter({ hasText: new RegExp(`^${day}`) });
/** The slot for a meal on a day, found by its Add button. */
const slot = (page: Page, meal: string, day: string) => page.getByRole("button", { name: new RegExp(`^Add food to ${meal} on ${day}`) });
const planned = (page: Page, name: RegExp) => page.getByRole("button", { name: new RegExp(`${name.source}.*Change portion`) });
const announcer = (page: Page) => page.locator("[id^=DndLiveRegion]");

/** Drags with the mouse in small steps, so the drag library sees a real drag. Hover runs mid-drag. */
async function drag(page: Page, from: Locator, to: Locator, hover?: () => Promise<void>) {
  const a = (await from.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 4 });
  const b = (await to.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await hover?.();
  await page.mouse.up();
}

test("drag a food from the library into a slot, with a preview of the slot total", async ({ page, request }) => {
  const u = await createUser(request);
  await signIn(page, u);
  await page.goto("/plan");
  await page.getByRole("button", { name: "Build my own" }).click();
  await page.getByRole("button", { name: "Food library" }).click();

  const library = page.getByRole("complementary", { name: "Food library" });
  const card = library.getByRole("button", { name: IDLI });
  await drag(page, card, slot(page, "breakfast", "Tuesday"), async () => {
    await expect(page.getByText("→ 270 kcal")).toBeVisible();
    await expectAccessible(page);
  });

  await expect(header(page, "Tue")).toContainText("270 kcal");
  await expect(announcer(page)).toContainText(/Added 2 idli with sambar.* to Tuesday breakfast\. Breakfast is now 270 kcal/);
});

test("drag a planned food to another day to move it, then undo", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon] = thisWeek();
  await planDay(request, u, mon, [["breakfast", IDLI, 1]]);
  await signIn(page, u);
  await page.goto("/plan");

  await drag(page, planned(page, IDLI), slot(page, "dinner", "Wednesday"), () => expectAccessible(page));
  await expect(header(page, "Wed")).toContainText("270 kcal");
  await expect(header(page, "Mon")).toContainText("—");
  await expect(announcer(page)).toContainText(/Moved 2 idli with sambar.* to Wednesday dinner\. Dinner is now 270 kcal/);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(header(page, "Mon")).toContainText("270 kcal");
  await expect(header(page, "Wed")).toContainText("—");
});

test("holding Alt while dragging copies instead of moving", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon] = thisWeek();
  await planDay(request, u, mon, [["breakfast", IDLI, 1]]);
  await signIn(page, u);
  await page.goto("/plan");

  await page.keyboard.down("Alt");
  await drag(page, planned(page, IDLI), slot(page, "lunch", "Thursday"));
  await page.keyboard.up("Alt");
  await expect(header(page, "Thu")).toContainText("270 kcal");
  await expect(header(page, "Mon")).toContainText("270 kcal");
  await expect(page.getByText(/Copied 2 idli with sambar.* to Thu lunch/)).toBeVisible();
});

test("keyboard only: pick up with Space, move with arrows, drop with Space", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon] = thisWeek();
  await planDay(request, u, mon, [["breakfast", IDLI, 1]]);
  await signIn(page, u);
  await page.goto("/plan");

  await planned(page, IDLI).focus();
  await page.keyboard.press("Space");
  await expect(announcer(page)).toContainText("Picked up 2 idli with sambar");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(announcer(page)).toContainText("Tuesday breakfast");
  await page.keyboard.press("ArrowDown");
  await expect(announcer(page)).toContainText("Tuesday lunch");
  await expectAccessible(page);
  await page.keyboard.press("Space");

  await expect(header(page, "Tue")).toContainText("270 kcal");
  await expect(header(page, "Mon")).toContainText("—");
  await expect(announcer(page)).toContainText(/Moved 2 idli with sambar.* to Tuesday lunch/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Escape cancels a keyboard drag and Enter still opens the food", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon] = thisWeek();
  await planDay(request, u, mon, [["breakfast", IDLI, 1]]);
  await signIn(page, u);
  await page.goto("/plan");

  await planned(page, IDLI).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(announcer(page)).toContainText("not moved");
  await expect(header(page, "Mon")).toContainText("270 kcal");
  await expect(header(page, "Tue")).toContainText("—");

  await planned(page, IDLI).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: /2 idli with sambar/ })).toBeVisible();
});

test("on a phone, long-press a food and drag it to another meal @phone", async ({ page, request }) => {
  const u = await createUser(request);
  const [mon] = thisWeek();
  await planDay(request, u, mon, [["breakfast", IDLI, 1]]);
  await signIn(page, u);
  await page.goto("/plan");
  await page.getByRole("tablist", { name: "Days of the week" }).getByRole("tab").first().click();

  // Keep both slots away from the screen edges, where dragging scrolls the page.
  await slot(page, "lunch", "Monday").evaluate((el) => el.scrollIntoView({ block: "center" }));
  const a = (await planned(page, IDLI).boundingBox())!;
  const b = (await slot(page, "lunch", "Monday").boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, x: number, y: number) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
  await touch("touchStart", a.x + 20, a.y + a.height / 2);
  await page.waitForTimeout(400); // past the long-press delay
  for (let i = 1; i <= 10; i++) await touch("touchMove", a.x + 20, a.y + a.height / 2 + ((b.y + b.height / 2 - a.y - a.height / 2) * i) / 10);
  await touch("touchEnd", 0, 0);

  const panel = page.getByRole("tabpanel");
  await expect(panel.getByRole("region", { name: "Lunch" })).toContainText("270 kcal");
  await expect(panel.getByRole("region", { name: "Breakfast" })).toContainText("0 kcal");
});
