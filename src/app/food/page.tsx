import type { Metadata } from "next";
import { FoodView } from "@/views/food";

export const metadata: Metadata = { title: "Food" };

export default function Page() {
  return <FoodView />;
}
