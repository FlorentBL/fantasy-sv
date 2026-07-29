import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fantasy-sv.flobl.workers.dev"),
  title: "Fantasy SV | Ton équipe Premier League",
  description: "Construis ton équipe Premier League Soccerverse avec un budget de 100 crédits.",
  openGraph: {
    title: "Fantasy SV",
    description: "La Premier League. Cent crédits. Ton équipe.",
    type: "website",
    images: [{ url: "/og-fantasy-sv-logo.png", width: 1200, height: 630, alt: "Logo Fantasy SV" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fantasy SV",
    description: "La Premier League. Cent crédits. Ton équipe.",
    images: ["/og-fantasy-sv-logo.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
