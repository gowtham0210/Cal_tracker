import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { api, DAY, download, foodId, onboardedUser, pdfPages, WEEK } = await import("./helpers.js");

async function planned() {
  const u = await onboardedUser();
  const { token } = u;
  const idli = await foodId(token, /^2 idli with sambar/);
  const rice = await foodId(token, /^Curd rice/);
  const chettinad = await foodId(token, /^Chicken chettinad/);
  const put = (i: number, items: object[]) => api("PUT", `/meal-plans/${WEEK}/days/${DAY(i)}`, { token, body: { items } });
  await put(0, [{ meal: "breakfast", foodId: idli, quantity: 1.5 }, { meal: "lunch", foodId: rice, quantity: 1 }]);
  // 560 × 3.5 = 1,960: within ±100 kcal of 1,900.
  await put(1, [{ meal: "lunch", foodId: chettinad, quantity: 3.5 }]);
  await put(2, [{ meal: "dinner", foodId: chettinad, quantity: 4 }]);
  return { token, name: u.user.name as string };
}
const exportPdf = (token: string, qs: string) => download(`/meal-plans/${WEEK}/export?${qs}`, token);

describe("PDF export", () => {
  test("a week: landscape grid with the name, dates, goal, foods, daily totals and status in words", async () => {
    const { token, name } = await planned();
    const r = await exportPdf(token, "scope=week");
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "application/pdf");
    assert.match(r.headers.get("content-disposition")!, /attachment; filename="meal-plan-2026-10-05\.pdf"/);
    const pages = await pdfPages(r.bytes);
    assert.equal(pages.length, 1);
    assert.ok(pages[0].landscape);
    const text = pages[0].text;
    for (const want of [name, "5–11 October 2026", "Goal 1,900 kcal a day", "Breakfast", "Lunch", "Snacks", "Dinner", "2 idli with sambar & tomato chutney", "1½ ×", "Mon 5", "Sun 11"]) {
      assert.ok(text.includes(want), `missing "${want}" in: ${text.slice(0, 400)}`);
    }
    assert.match(text, /685 kcal Under by 1,215/);
    assert.match(text, /1,960 kcal On target/);
    assert.match(text, /2,240 kcal Over by 340/);
    assert.match(text, /Not planned/);
    assert.ok(!/Protein|P \d+ g · C/.test(text), "no macros unless asked");
  });

  test("macros when asked, per day and as a weekly summary", async () => {
    const { token } = await planned();
    const text = (await pdfPages((await exportPdf(token, "scope=week&includeMacros=true")).bytes))[0].text;
    assert.match(text, /P \d+ g · C \d+ g · F \d+ g/);
    assert.match(text, /Average per planned day: [\d,]+ kcal · Protein \d+ g \(\d+%\) · Carbs \d+ g \(\d+%\) · Fat \d+ g \(\d+%\)/);
    assert.match(text, /1 of 3 planned days on target/);
  });

  test("one day: portrait, meal by meal, with portions, totals and status", async () => {
    const { token } = await planned();
    const r = await exportPdf(token, `scope=day&date=${DAY(0)}&includeMacros=true`);
    assert.match(r.headers.get("content-disposition")!, /meal-plan-2026-10-05\.pdf/);
    const [page] = await pdfPages(r.bytes);
    assert.ok(!page.landscape);
    for (const want of ["Monday 5 October 2026", "Goal 1,900 kcal a day", "Breakfast", "2 idli with sambar & tomato chutney", "1½ × 1 plate (2 idli)", "Curd rice (1 cup)", "Total 685 kcal", "Under by 1,215 kcal", "Protein"]) {
      assert.ok(page.text.includes(want), `missing "${want}" in: ${page.text.slice(0, 400)}`);
    }
  });

  test("a day without macros leaves them out", async () => {
    const { token } = await planned();
    const [page] = await pdfPages((await exportPdf(token, `scope=day&date=${DAY(0)}`)).bytes);
    assert.ok(page.text.includes("Total 685 kcal"));
    assert.ok(!/Protein|P \d+ g · C/.test(page.text));
  });

  test("a busy meal shows its first foods and how many more", async () => {
    const { token } = await planned();
    const idli = await foodId(token, /^2 idli with sambar/);
    await api("PUT", `/meal-plans/${WEEK}/days/${DAY(3)}`, { token, body: { items: Array.from({ length: 9 }, () => ({ meal: "snack", foodId: idli, quantity: 0.25 })) } });
    const pages = await pdfPages((await exportPdf(token, "scope=week")).bytes);
    assert.equal(pages.length, 1);
    assert.match(pages[0].text, /\+4 more/);
  });

  test("validates the request", async () => {
    const { token } = await planned();
    assert.equal((await exportPdf(token, "scope=day")).status, 400);
    assert.equal((await exportPdf(token, "scope=day&date=2026-10-20")).status, 400);
    assert.equal((await exportPdf(token, "scope=month")).status, 400);
    assert.equal((await exportPdf(token, "scope=week&includeMacros=maybe")).status, 400);
  });
});
