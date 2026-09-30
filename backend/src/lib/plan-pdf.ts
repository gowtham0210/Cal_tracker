import PDFDocument from "pdfkit";
import { MEALS, type Meal, type MealPlan } from "./plan.js";

// The plan as a printable PDF: a week grid on A4 landscape, or one day on A4 portrait. Black
// text and grey rules only, so it reads the same printed in black and white; every status is
// written out in words. Numbers are the plan's own (library values × quantity).

type Doc = PDFKit.PDFDocument;
type Item = MealPlan["items"][number];
type Day = MealPlan["days"][number];

const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snacks", dinner: "Dinner" };
const MARGIN = 36;
const INK = "#000000";
const SOFT = "#444444";
const RULE = "#999999";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const FRACTIONS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };
/** 1.5 → "1½", 0.25 → "¼". */
const qty = (q: number) => {
  const whole = Math.floor(q);
  const frac = FRACTIONS[String(Math.round((q - whole) * 100) / 100)] ?? "";
  return `${whole || (frac ? "" : "0")}${frac}`;
};
const utc = (d: string) => new Date(`${d}T12:00:00Z`);
const dateText = (d: string, opts: Intl.DateTimeFormatOptions) => utc(d).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

/** "5–11 October 2026", "28 September – 4 October 2026" or across years in full. */
function weekRange(days: Day[]) {
  const [a, b] = [utc(days[0].date), utc(days[6].date)];
  const day = (d: Date) => d.getUTCDate();
  const month = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${day(a)} ${month(a)} ${a.getUTCFullYear()} – ${day(b)} ${month(b)} ${b.getUTCFullYear()}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${day(a)} ${month(a)} – ${day(b)} ${month(b)} ${b.getUTCFullYear()}`;
  return `${day(a)}–${day(b)} ${month(b)} ${b.getUTCFullYear()}`;
}

/** The goal status in words, never colour alone. */
export function statusWords(s: Day["status"]) {
  if (s.state === "empty") return "Not planned";
  if (s.state === "on-target") return "On target";
  return `${s.state === "under" ? "Under" : "Over"} by ${fmt(Math.abs(s.difference))} kcal`;
}

type Macros = { protein: number; carbs: number; fat: number };
const macroLine = (n: Macros) => `P ${fmt(n.protein)} g · C ${fmt(n.carbs)} g · F ${fmt(n.fat)} g`;
/** "Protein 80 g (17%) · Carbs 264 g (56%) · Fat 56 g (27%)": shares of the calories from macros. */
function macroSplit(n: Macros) {
  const kcal = n.protein * 4 + n.carbs * 4 + n.fat * 9 || 1;
  const pct = (g: number, per: number) => Math.round(((g * per) / kcal) * 100);
  return `Protein ${fmt(n.protein)} g (${pct(n.protein, 4)}%) · Carbs ${fmt(n.carbs)} g (${pct(n.carbs, 4)}%) · Fat ${fmt(n.fat)} g (${pct(n.fat, 9)}%)`;
}
// A week cell shows at most this many foods, then "+N more", so a row always fits on a page.
const MAX_PER_CELL = 6;

// The built-in PDF fonts only cover Windows-1252; anything else is simplified or replaced.
const PRINTABLE = /[\x20-\x7E -ÿŒœŠšŸŽžƒˆ˜–—‘-‚“-„†-•…‰‹›€™]/;
export const printable = (s: string) =>
  [...s.normalize("NFC")]
    .map((c) => {
      if (PRINTABLE.test(c)) return c;
      if (c === "₹") return "Rs ";
      // "ā" → "a"; anything that still can't be drawn becomes "?".
      const plain = [...c.normalize("NFKD")].filter((x) => !/\p{M}/u.test(x)).join("");
      return plain && [...plain].every((x) => PRINTABLE.test(x)) ? plain : "?";
    })
    .join("");

function header(doc: Doc, title: string, subtitle: string) {
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(16).text(printable(title), MARGIN, MARGIN);
  doc.font("Helvetica").fontSize(10).fillColor(SOFT).text(printable(subtitle));
  doc.moveDown(0.8);
}

function rule(doc: Doc, x1: number, x2: number, y: number) {
  doc.save().lineWidth(0.5).strokeColor(RULE).moveTo(x1, y).lineTo(x2, y).stroke().restore();
}

/* ---------------- Week ---------------- */

function weekPage(doc: Doc, plan: MealPlan, name: string, macros: boolean) {
  header(doc, `Meal plan · ${name}`, `${weekRange(plan.days)} · Goal ${fmt(plan.calorieGoal)} kcal a day`);
  const width = doc.page.width - MARGIN * 2;
  const labelW = 64;
  const colW = (width - labelW) / 7;
  const pad = 4;
  const x = (i: number) => MARGIN + labelW + i * colW;
  const bottom = doc.page.height - MARGIN;

  const dayHeader = () => {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(INK);
    plan.days.forEach((d, i) => doc.text(dateText(d.date, { weekday: "short", day: "numeric" }), x(i) + pad, y, { width: colW - pad * 2 }));
    doc.y = y + 14;
    rule(doc, MARGIN, MARGIN + width, doc.y);
  };

  /** One row: a label and a cell per day, drawn with the given writer; the row is as tall as its tallest cell. */
  const row = (label: string, write: (i: number, measure: boolean) => number) => {
    const h = Math.max(12, ...plan.days.map((_, i) => write(i, true))) + pad * 2;
    if (doc.y + h > bottom) {
      doc.addPage();
      doc.y = MARGIN;
      dayHeader();
    }
    const top = doc.y;
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text(label, MARGIN, top + pad, { width: labelW - pad });
    plan.days.forEach((_, i) => {
      doc.y = top + pad;
      write(i, false);
    });
    doc.y = top + h;
    rule(doc, MARGIN, MARGIN + width, doc.y);
  };

  /** Writes (or measures) lines of text in a day's cell, returning their height. */
  const cell = (i: number, measure: boolean, lines: { text: string; bold?: boolean; soft?: boolean; size?: number }[]) => {
    let h = 0;
    for (const l of lines) {
      doc.font(l.bold ? "Helvetica-Bold" : "Helvetica").fontSize(l.size ?? 7.5);
      const opts = { width: colW - pad * 2 };
      const t = printable(l.text);
      if (!measure) doc.fillColor(l.soft ? SOFT : INK).text(t, x(i) + pad, doc.y, opts);
      h += doc.heightOfString(t, opts);
    }
    return h;
  };

  dayHeader();
  for (const meal of MEALS) {
    row(MEAL_LABEL[meal], (i, measure) => {
      const items = plan.items.filter((it) => it.date === plan.days[i].date && it.meal === meal);
      const shown = items.length > MAX_PER_CELL ? items.slice(0, MAX_PER_CELL - 1) : items;
      const lines: { text: string; soft?: boolean; size?: number }[] = shown.flatMap((it) => [{ text: it.food.name }, { text: `${qty(it.quantity)} × · ${fmt(it.calories)} kcal`, soft: true, size: 7 }]);
      if (shown.length < items.length) lines.push({ text: `+${items.length - shown.length} more`, soft: true, size: 7 });
      return cell(i, measure, lines);
    });
  }
  row("Total", (i, measure) => {
    const d = plan.days[i];
    const lines = [
      { text: d.status.state === "empty" ? "—" : `${fmt(d.calories)} kcal`, bold: true, size: 8 },
      { text: statusWords(d.status), size: 7.5 },
      ...(macros && d.status.state !== "empty" ? [{ text: macroLine(d), soft: true, size: 7 }] : []),
    ];
    return cell(i, measure, lines);
  });

  doc.moveDown(0.8);
  doc.x = MARGIN;
  const { daysOnTarget, plannedDays } = plan.week;
  doc.font("Helvetica").fontSize(9).fillColor(INK).text(`${daysOnTarget} of ${plannedDays} planned days on target (within ${fmt(plan.toleranceKcal)} kcal of the goal).`, MARGIN);
  if (macros && plannedDays) doc.text(averages(plan));
}

function averages(plan: MealPlan) {
  const n = plan.week.plannedDays;
  return `Average per planned day: ${fmt(plan.week.averageCalories)} kcal · ${macroSplit({ protein: plan.week.protein / n, carbs: plan.week.carbs / n, fat: plan.week.fat / n })}`;
}

/* ---------------- Day ---------------- */

function dayPage(doc: Doc, plan: MealPlan, name: string, date: string, macros: boolean) {
  const day = plan.days.find((d) => d.date === date)!;
  const long = `${dateText(date, { weekday: "long" })} ${dateText(date, { day: "numeric", month: "long", year: "numeric" })}`;
  header(doc, `Meal plan · ${name}`, `${long} · Goal ${fmt(plan.calorieGoal)} kcal a day`);
  const width = doc.page.width - MARGIN * 2;
  const right = (t: string, y: number, bold = false) => doc.font(bold ? "Helvetica-Bold" : "Helvetica").text(t, MARGIN, y, { width, align: "right" });

  for (const meal of MEALS) {
    const items = plan.items.filter((i: Item) => i.date === date && i.meal === meal);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(MEAL_LABEL[meal], MARGIN, y);
    right(items.length ? `${fmt(day.meals[meal].calories)} kcal` : "", y, true);
    doc.y = y + 18;
    rule(doc, MARGIN, MARGIN + width, doc.y);
    doc.moveDown(0.3);
    if (!items.length) doc.font("Helvetica").fontSize(9).fillColor(SOFT).text("Nothing planned", MARGIN);
    for (const i of items) {
      const top = doc.y;
      doc.font("Helvetica").fontSize(10).fillColor(INK).text(printable(i.food.name), MARGIN, top, { width: width - 90 });
      const after = doc.y;
      right(`${fmt(i.calories)} kcal`, top);
      doc.y = after;
      doc.fontSize(8.5).fillColor(SOFT).text(printable(`${qty(i.quantity)} × ${i.food.serving}${macros ? ` · ${macroLine(i)}` : ""}`), MARGIN, doc.y, { width: width - 90 });
      doc.moveDown(0.4);
    }
    doc.moveDown(0.6);
  }

  rule(doc, MARGIN, MARGIN + width, doc.y);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(`Total ${day.status.state === "empty" ? "0" : fmt(day.calories)} kcal · ${statusWords(day.status)}`, MARGIN);
  if (macros && day.status.state !== "empty") doc.font("Helvetica").fontSize(10).text(macroSplit(day));
}

/* ---------------- Document ---------------- */

export interface PdfOptions {
  plan: MealPlan;
  name: string;
  scope: "week" | "day";
  date?: string;
  macros: boolean;
}

export function planPdf(o: PdfOptions): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    layout: o.scope === "week" ? "landscape" : "portrait",
    margin: MARGIN,
    info: { Title: `Meal plan ${o.scope === "week" ? weekRange(o.plan.days) : o.date}`, Author: printable(o.name), Creator: "Lighter" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  if (o.scope === "week") weekPage(doc, o.plan, o.name, o.macros);
  else dayPage(doc, o.plan, o.name, o.date!, o.macros);
  doc.end();
  return done;
}
