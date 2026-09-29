import type { Metadata } from "next";
import { GoalsView } from "@/views/goals";

export const metadata: Metadata = { title: "Goals & milestones" };

export default function Page() {
  return <GoalsView />;
}
