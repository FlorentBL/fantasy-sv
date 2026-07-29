import { FantasyApp } from "@/app/fantasy-app";
import { LanguageProvider } from "@/lib/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My team | Fantasy SV" };

export default function TeamPage() {
  return <LanguageProvider><FantasyApp view="team" /></LanguageProvider>;
}
