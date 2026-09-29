import type { Metadata } from "next";
import { BodyView } from "@/views/body";

export const metadata: Metadata = { title: "Body" };

export default function Page() {
  return <BodyView />;
}
