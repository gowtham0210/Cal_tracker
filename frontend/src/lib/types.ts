export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodEntry extends Macros {
  id: string;
  date: string; // YYYY-MM-DD
  meal: MealType;
  name: string;
  calories: number;
  source?: "manual" | "ai-text" | "ai-photo" | "favorite";
  favoriteId?: string | null;
  createdAt: number;
}

export interface FavoriteFood extends Macros {
  id: string;
  name: string;
  calories: number;
  meal: MealType;
}

export interface WeightEntry {
  /** The date; weigh-ins are one per day. */
  id: string;
  date: string;
  weight: number; // kg
}

export interface MeasurementEntry {
  /** The date; measurements are one set per day. */
  id: string;
  date: string;
  waist?: number; // cm
  hips?: number;
  chest?: number;
}

export interface ExerciseEntry {
  id: string;
  date: string;
  name: string;
  minutes: number;
  calories: number;
}

export type Mood = 1 | 2 | 3 | 4 | 5;

export interface JournalEntry {
  date: string;
  mood?: Mood;
  energy?: 1 | 2 | 3;
  sleepHours?: number;
  cravings?: 0 | 1 | 2 | 3;
  note?: string;
}

export type UnitSystem = "metric" | "imperial";
export type Theme = "system" | "light" | "dark";

export interface Profile {
  name: string;
  heightCm: number;
  startWeight: number;
  goalWeight: number;
  startDate: string;
  calorieGoal: number;
  macroGoals: Macros;
  trackMacros: boolean;
  waterGoal: number; // glasses
  glassMl: number;
  units: UnitSystem;
  theme: Theme;
  /** IANA time zone; decides what "today" means on the server. */
  timeZone: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}
