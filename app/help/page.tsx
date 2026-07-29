import { BetaHelp } from "@/app/help/beta-help";
import { LanguageProvider } from "@/lib/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aide et règles | Fantasy SV" };

export default function HelpPage() {
  return <LanguageProvider><BetaHelp /></LanguageProvider>;
}
