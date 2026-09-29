import type { Metadata } from "next";
import { OnboardingView } from "@/views/onboarding";

export const metadata: Metadata = { title: "Set up your goals" };

export default function Page() {
  return <OnboardingView />;
}
