/**
 * AI features, served by the backend (Azure OpenAI). The server grounds every answer in the
 * user's own logs and validates what the model returns.
 */
import { api, type EstimatedFood, type MealIdea, type WeeklySummary } from "./api";
import type { MealType } from "./types";

export type { WeeklySummary };

export async function aiParseFood(text: string): Promise<EstimatedFood[]> {
  return (await api.estimateFoodText(text)).items;
}

const SENDABLE = ["image/jpeg", "image/png", "image/webp"];
const MAX_EDGE = 1600;

/**
 * Shrinks the photo before upload: faster, cheaper for the model (fewer image tokens), under
 * the 10 MB limit, and converts formats the API doesn't take (e.g. HEIC) to JPEG.
 */
async function preparePhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && SENDABLE.includes(file.type) && file.size < 4 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85));
  } catch {
    // The browser can't decode it; let the server decide.
    return file;
  }
}

export async function aiEstimatePhoto(file: File): Promise<EstimatedFood[]> {
  return (await api.estimateFoodPhoto(await preparePhoto(file))).items;
}

export async function aiSuggestMeals(args: { date: string; meal?: MealType }): Promise<MealIdea[]> {
  return api.mealSuggestions(args.date, args.meal);
}

export async function aiWeeklySummary(asOf: string): Promise<WeeklySummary> {
  return api.weeklySummary(asOf);
}

export const CHAT_STARTERS = [
  "How much weight have I lost?",
  "What's my average calorie intake this week?",
  "When will I reach my goal?",
  "Am I eating enough protein?",
  "How does sleep affect my mood?",
  "What was my best day this month?",
];
