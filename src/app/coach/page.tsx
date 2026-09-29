import type { Metadata } from "next";
import { CoachView } from "@/views/coach";

export const metadata: Metadata = { title: "AI Coach" };

export default function Page() {
  return <CoachView />;
}
