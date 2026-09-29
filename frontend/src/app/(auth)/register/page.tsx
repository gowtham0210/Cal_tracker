import type { Metadata } from "next";
import { RegisterView } from "@/views/register";

export const metadata: Metadata = { title: "Create account" };

export default function Page() {
  return <RegisterView />;
}
