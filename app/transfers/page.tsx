import { FantasyApp } from "@/app/fantasy-app";
import { LanguageProvider } from "@/lib/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transfers | Fantasy SV" };

export default function TransfersPage() {
  return <LanguageProvider><FantasyApp view="transfers" /></LanguageProvider>;
}
