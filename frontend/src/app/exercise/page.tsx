import type { Metadata } from "next";
import { ExerciseView } from "@/views/exercise";

export const metadata: Metadata = { title: "Exercise" };

export default function Page() {
  return <ExerciseView />;
}
