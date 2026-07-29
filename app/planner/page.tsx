import type { Metadata } from "next";
import { LanguageProvider } from "@/lib/i18n";
import { FantasyPlanner } from "./fantasy-planner";

export const metadata: Metadata = { title: "Planner | Fantasy SV" };

export default function PlannerPage() {
  return <LanguageProvider><FantasyPlanner /></LanguageProvider>;
}
