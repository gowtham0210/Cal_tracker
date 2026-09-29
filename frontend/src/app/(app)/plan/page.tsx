import type { Metadata } from "next";
import { PlanView } from "@/views/plan/plan-view";

export const metadata: Metadata = { title: "Plan" };

export default function Page() {
  return <PlanView />;
}
