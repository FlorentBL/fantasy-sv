import { FantasyApp } from "@/app/fantasy-app";
import { LanguageProvider } from "@/lib/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Classements | Fantasy SV" };

export default function RankingsPage() {
  return <LanguageProvider><FantasyApp view="rankings" /></LanguageProvider>;
}
