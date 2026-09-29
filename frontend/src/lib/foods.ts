/** Types for AI food results and meal ideas, which now come from the API. */
export type { EstimatedFood as ParsedFood, MealIdea } from "./api";

/** Common workouts with typical burn rates, for quick logging. */
export const EXERCISE_PRESETS: { name: string; calPerMin: number; emoji: string }[] = [
  { name: "Walking", calPerMin: 4.5, emoji: "🚶" },
  { name: "Running", calPerMin: 11, emoji: "🏃" },
  { name: "Cycling", calPerMin: 8, emoji: "🚴" },
  { name: "Strength training", calPerMin: 6, emoji: "🏋️" },
  { name: "Yoga", calPerMin: 3.5, emoji: "🧘" },
  { name: "Swimming", calPerMin: 9, emoji: "🏊" },
  { name: "HIIT", calPerMin: 12, emoji: "⚡" },
  { name: "Dancing", calPerMin: 6.5, emoji: "💃" },
];
