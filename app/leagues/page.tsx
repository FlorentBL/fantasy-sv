import { FantasyApp } from "@/app/fantasy-app";
import { LanguageProvider } from "@/lib/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mini-ligues | Fantasy SV" };

export default function LeaguesPage() {
  return <LanguageProvider><FantasyApp view="leagues" /></LanguageProvider>;
}
