import { FantasyApp } from "./fantasy-app";
import { LanguageProvider } from "@/lib/i18n";

export default function Home() {
  return (
    <LanguageProvider>
      <FantasyApp />
    </LanguageProvider>
  );
}
