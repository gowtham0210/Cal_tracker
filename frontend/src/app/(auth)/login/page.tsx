import type { Metadata } from "next";
import { LoginView } from "@/views/login";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <LoginView />;
}
