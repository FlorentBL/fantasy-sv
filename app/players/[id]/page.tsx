import type { Metadata } from "next";
import { PlayerProfile } from "./player-profile";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = { title: "Fiche joueur | Fantasy SV" };

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LanguageProvider><PlayerProfile playerId={id} /></LanguageProvider>;
}
