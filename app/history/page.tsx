import type { Metadata } from "next";
import { ManagerHistory } from "./manager-history";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = { title: "Manager history | Fantasy SV" };

export default function HistoryPage() {
  return <LanguageProvider><ManagerHistory /></LanguageProvider>;
}
