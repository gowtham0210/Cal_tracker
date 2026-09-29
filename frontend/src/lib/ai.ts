/**
 * Mock AI layer. Every function is async and simulates latency so the UI can show
 * realistic loading states. Swap these implementations for real API calls later.
 */
import {
  averageCalories,
  bmi,
  bmiCategory,
  currentStreak,
  dayTotals,
  fmt1,
  goalProgress,
  latestWeight,
  longestStreak,
  projectedGoalDate,
  weekDays,
  weeklyRate,
  weightOn,
  weightOut,
  wUnit,
} from "./calc";
import { addDays, formatDate, lastNDays, todayKey } from "./date";
import { FOOD_DB, MEAL_IDEAS, parseFoodText, type MealIdea, type ParsedFood } from "./foods";
import type { SeedData } from "./mock";
import type { MealType } from "./types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function aiParseFood(text: string): Promise<ParsedFood[]> {
  await wait(700 + Math.random() * 500);
  return parseFoodText(text);
}

const PLATES: ParsedFood[][] = [
  [
    { name: "Grilled chicken breast", quantity: 1, serving: "~150 g", calories: 250, protein: 46, carbs: 0, fat: 5, confidence: "high" },
    { name: "White rice", quantity: 1, serving: "~1 cup", calories: 205, protein: 4, carbs: 45, fat: 0, confidence: "medium" },
    { name: "Steamed broccoli", quantity: 1, serving: "~1 cup", calories: 55, protein: 4, carbs: 11, fat: 1, confidence: "high" },
  ],
  [
    {
      name: "Pasta with tomato sauce",
      quantity: 1,
      serving: "~1.5 cups",
      calories: 390,
      protein: 13,
      carbs: 72,
      fat: 6,
      confidence: "medium",
    },
    { name: "Parmesan", quantity: 1, serving: "~1 tbsp", calories: 22, protein: 2, carbs: 0, fat: 1, confidence: "low" },
    { name: "Side salad", quantity: 1, serving: "~1 bowl", calories: 60, protein: 2, carbs: 10, fat: 1, confidence: "high" },
  ],
  [
    { name: "Chapati", quantity: 2, serving: "2 pieces", calories: 240, protein: 6, carbs: 36, fat: 8, confidence: "high" },
    { name: "Dal", quantity: 1, serving: "~1 bowl", calories: 180, protein: 12, carbs: 28, fat: 3, confidence: "medium" },
    { name: "Mixed vegetable sabzi", quantity: 1, serving: "~1 cup", calories: 150, protein: 4, carbs: 16, fat: 8, confidence: "low" },
  ],
  [
    { name: "Avocado toast", quantity: 1, serving: "1 slice", calories: 240, protein: 6, carbs: 22, fat: 15, confidence: "high" },
    { name: "Poached egg", quantity: 1, serving: "1 large", calories: 72, protein: 6, carbs: 0, fat: 5, confidence: "high" },
  ],
];

export async function aiEstimatePhoto(file: File): Promise<ParsedFood[]> {
  await wait(1600 + Math.random() * 800);
  const idx = (file.size + file.name.length) % PLATES.length;
  return PLATES[idx].map((p) => ({ ...p }));
}

export async function aiSuggestMeals(args: { remaining: number; proteinLeft: number; meal?: MealType }): Promise<MealIdea[]> {
  await wait(500 + Math.random() * 400);
  const { remaining, proteinLeft, meal } = args;
  const budget = Math.max(remaining, 120);
  const fits = MEAL_IDEAS.filter((m) => m.calories <= budget && (!meal || m.meal === meal));
  const pool = fits.length ? fits : MEAL_IDEAS.filter((m) => m.meal === "snack");
  return [...pool]
    .sort((a, b) => {
      // Prefer protein-dense ideas when protein is lagging; otherwise use the budget well.
      const score = (m: MealIdea) => (proteinLeft > 30 ? (m.protein / m.calories) * 800 : 0) - Math.abs(budget * 0.6 - m.calories) / 50;
      return score(b) - score(a);
    })
    .slice(0, 4);
}

/* ---------------- Chat with your data ---------------- */

export const CHAT_STARTERS = [
  "How much weight have I lost?",
  "What's my average calorie intake this week?",
  "When will I reach my goal?",
  "Am I eating enough protein?",
  "How does sleep affect my mood?",
  "What was my best day this month?",
];

export async function aiChat(question: string, d: SeedData): Promise<string> {
  await wait(700 + Math.random() * 700);
  const q = question.toLowerCase();
  const p = d.profile;
  const u = p.units;
  const W = (kg: number) => `${fmt1(weightOut(kg, u))} ${wUnit(u)}`;
  const current = latestWeight(d.weights, p);
  const today = todayKey();

  if (/(lost|lose|progress|how.*doing|weight)/.test(q) && !/goal|when|reach/.test(q)) {
    const lost = p.startWeight - current;
    const monthAgo = weightOn(d.weights, addDays(today, -30));
    const monthly = monthAgo ? monthAgo - current : 0;
    return `You've lost **${W(lost)}** since you started on ${formatDate(p.startDate, { month: "long", day: "numeric" })} — from ${W(
      p.startWeight,
    )} to ${W(current)}. In the last 30 days alone you're down **${W(monthly)}**. That's ${Math.round(
      goalProgress(current, p),
    )}% of the way to your goal of ${W(p.goalWeight)}. 🎉`;
  }

  if (/(goal|when|reach|finish|projection)/.test(q)) {
    const eta = projectedGoalDate(d.weights, p);
    const rate = weeklyRate(d.weights);
    if (!eta)
      return `Your trend is flat right now, so I can't project a finish date yet. A small 200–300 kcal daily deficit should get the trend moving again.`;
    return `At your current pace of **${W(Math.abs(rate))}/week**, you're projected to hit ${W(p.goalWeight)} around **${formatDate(eta, {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}**. You have ${W(current - p.goalWeight)} to go.`;
  }

  if (/(protein)/.test(q)) {
    const days = lastNDays(7).filter((x) => d.foods.some((f) => f.date === x));
    const avg = days.reduce((s, x) => s + dayTotals(x, d.foods, d.exercises).protein, 0) / Math.max(1, days.length);
    const hit = days.filter((x) => dayTotals(x, d.foods, d.exercises).protein >= p.macroGoals.protein).length;
    const verdict = avg >= p.macroGoals.protein * 0.9 ? "You're doing well" : "You're a bit short";
    return `${verdict} — you averaged **${Math.round(avg)} g** of protein per day this week against a goal of ${p.macroGoals.protein} g, hitting it on ${hit} of ${days.length} logged days. ${
      avg < p.macroGoals.protein
        ? "Easy wins: Greek yogurt, a protein shake, or an extra egg at breakfast."
        : "Keep it up — protein helps preserve muscle while you lose fat."
    }`;
  }

  if (/(calorie|intake|eat|average|kcal)/.test(q)) {
    const avg = averageCalories(d.foods, d.exercises, weekDays());
    const prev = averageCalories(d.foods, d.exercises, weekDays(1));
    const diff = avg.intake - prev.intake;
    return `This week you averaged **${Math.round(avg.intake)} kcal/day** eaten and burned about ${Math.round(
      avg.burned,
    )} kcal through exercise, for a net of **${Math.round(avg.net)} kcal**. That's ${Math.abs(Math.round(diff))} kcal ${
      diff > 0 ? "more" : "less"
    } than last week. Your goal is ${p.calorieGoal} kcal.`;
  }

  if (/(sleep|mood|energy|feel)/.test(q)) {
    const entries = Object.values(d.journal).filter((j) => j.sleepHours && j.mood);
    const good = entries.filter((j) => (j.sleepHours ?? 0) >= 7);
    const bad = entries.filter((j) => (j.sleepHours ?? 0) < 7);
    const avg = (arr: typeof entries) => arr.reduce((s, j) => s + (j.mood ?? 0), 0) / Math.max(1, arr.length);
    return `Across ${entries.length} journal entries, on nights with **7+ hours** of sleep your mood averaged **${avg(good).toFixed(
      1,
    )}/5**, vs **${avg(bad).toFixed(1)}/5** on shorter nights. ${
      avg(good) > avg(bad)
        ? "Sleep looks like one of your strongest levers — protecting bedtime may help cravings too."
        : "Interesting — sleep doesn't seem to swing your mood much."
    }`;
  }

  if (/(best|worst|day)/.test(q)) {
    const days = lastNDays(30).filter((x) => d.foods.some((f) => f.date === x));
    const scored = days.map((x) => ({ x, t: dayTotals(x, d.foods, d.exercises) }));
    const best = scored.sort((a, b) => Math.abs(a.t.net - p.calorieGoal) - Math.abs(b.t.net - p.calorieGoal))[0];
    if (!best) return "I don't have enough logged days this month to pick a best day yet.";
    return `Your most on-target day this month was **${formatDate(best.x, { weekday: "long", month: "short", day: "numeric" })}**: ${Math.round(
      best.t.calories,
    )} kcal eaten, ${Math.round(best.t.burned)} burned, ${Math.round(best.t.protein)} g protein — almost exactly on your ${p.calorieGoal} kcal goal.`;
  }

  if (/(water|hydrat|drink)/.test(q)) {
    const days = lastNDays(7);
    const avg = days.reduce((s, x) => s + (d.water[x] ?? 0), 0) / 7;
    const hit = days.filter((x) => (d.water[x] ?? 0) >= p.waterGoal).length;
    return `You averaged **${avg.toFixed(1)} glasses** of water a day this week and hit your goal of ${p.waterGoal} on ${hit} of 7 days.`;
  }

  if (/(streak|consisten|log)/.test(q)) {
    return `Your current logging streak is **${currentStreak(d.foods)} days** 🔥 and your longest ever is ${longestStreak(d.foods)} days.`;
  }

  if (/(exercise|workout|burn|active|run|walk)/.test(q)) {
    const days = lastNDays(7);
    const ex = d.exercises.filter((e) => days.includes(e.date));
    const total = ex.reduce((s, e) => s + e.calories, 0);
    const mins = ex.reduce((s, e) => s + e.minutes, 0);
    return `In the last 7 days you logged **${ex.length} workouts** — ${mins} minutes and about **${total} kcal** burned. ${
      ex.length >= 4 ? "Great consistency!" : "Try adding one more short walk this week."
    }`;
  }

  if (/(bmi)/.test(q)) {
    const b = bmi(current, p.heightCm);
    const startB = bmi(p.startWeight, p.heightCm);
    return `Your BMI is **${b.toFixed(1)}** (${bmiCategory(b).label}), down from ${startB.toFixed(1)} when you started. Remember BMI is a rough guide — your waist measurement and how you feel matter too.`;
  }

  const food = FOOD_DB.find((f) => f.aliases.some((a) => q.includes(a)));
  if (food) {
    return `A typical serving of **${food.name}** (${food.serving}) is about **${food.calories} kcal** — ${food.protein} g protein, ${food.carbs} g carbs, ${food.fat} g fat.`;
  }

  return `I can answer questions about your weight, calories, protein, water, workouts, sleep & mood, streaks and goal timeline. Try something like “How much weight have I lost?”`;
}

/* ---------------- Weekly coach summary ---------------- */

export interface WeeklySummary {
  headline: string;
  bullets: { label: string; value: string; trend: "up" | "down" | "flat"; good: boolean }[];
  tip: string;
}

export async function aiWeeklySummary(d: SeedData): Promise<WeeklySummary> {
  await wait(900 + Math.random() * 600);
  const p = d.profile;
  const u = p.units;
  const W = (kg: number) => `${fmt1(Math.abs(weightOut(kg, u)))} ${wUnit(u)}`;
  const thisWeek = weekDays();
  const lastWeek = weekDays(1);
  const a = averageCalories(d.foods, d.exercises, thisWeek);
  const b = averageCalories(d.foods, d.exercises, lastWeek);
  const wNow = weightOn(d.weights, thisWeek[6]) ?? p.startWeight;
  const wPrev = weightOn(d.weights, lastWeek[6]) ?? wNow;
  const delta = wNow - wPrev;
  const protein = thisWeek.reduce((s, x) => s + dayTotals(x, d.foods, d.exercises).protein, 0) / Math.max(1, a.days);
  const water = thisWeek.reduce((s, x) => s + (d.water[x] ?? 0), 0) / 7;
  const workouts = d.exercises.filter((e) => thisWeek.includes(e.date)).length;
  const lastWorkouts = d.exercises.filter((e) => lastWeek.includes(e.date)).length;

  const headline =
    delta < -0.1
      ? `Solid week — you're down ${W(delta)} and your trend keeps heading the right way.`
      : delta > 0.3
        ? `Scale's up ${W(delta)} this week — likely water or salt. The long-term trend is what counts.`
        : `A steady week. Weight held roughly flat, which is normal between drops.`;

  const tips: { cond: boolean; tip: string }[] = [
    {
      cond: protein < p.macroGoals.protein * 0.85,
      tip: `Protein averaged ${Math.round(protein)} g vs your ${p.macroGoals.protein} g goal. Add one protein-first snack (Greek yogurt or a shake) each afternoon.`,
    },
    {
      cond: water < p.waterGoal * 0.8,
      tip: `You averaged ${water.toFixed(1)} of ${p.waterGoal} glasses. Try a glass of water before each meal — it also takes the edge off hunger.`,
    },
    {
      cond: a.net > p.calorieGoal + 100,
      tip: `Net calories ran ~${Math.round(a.net - p.calorieGoal)} kcal above goal. Pre-log dinner in the morning so evening choices are already made.`,
    },
    { cond: workouts < 3, tip: `Only ${workouts} workouts this week. A 20-minute walk after dinner is the easiest one to add.` },
    { cond: true, tip: `You're consistent — great. Try planning tomorrow's meals the night before to protect your streak on busy days.` },
  ];

  return {
    headline,
    bullets: [
      {
        label: "Weight change",
        value: `${delta <= 0 ? "−" : "+"}${W(delta)}`,
        trend: delta < -0.05 ? "down" : delta > 0.05 ? "up" : "flat",
        good: delta <= 0.05,
      },
      {
        label: "Avg calories",
        value: `${Math.round(a.intake)} kcal`,
        trend: a.intake < b.intake - 20 ? "down" : a.intake > b.intake + 20 ? "up" : "flat",
        good: a.intake <= p.calorieGoal + 100,
      },
      { label: "Avg protein", value: `${Math.round(protein)} g`, trend: "flat", good: protein >= p.macroGoals.protein * 0.85 },
      {
        label: "Workouts",
        value: `${workouts} (${workouts - lastWorkouts >= 0 ? "+" : ""}${workouts - lastWorkouts})`,
        trend: workouts > lastWorkouts ? "up" : workouts < lastWorkouts ? "down" : "flat",
        good: workouts >= 3,
      },
      { label: "Water", value: `${water.toFixed(1)} glasses/day`, trend: "flat", good: water >= p.waterGoal * 0.8 },
    ],
    tip: tips.find((t) => t.cond)!.tip,
  };
}
