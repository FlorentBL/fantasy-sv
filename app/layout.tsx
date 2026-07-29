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
  title: "Fantasy SV | Premier League fantasy football",
  description: "Build your Soccerverse Premier League squad with a 100-credit budget.",
  openGraph: {
    title: "Fantasy SV",
    description: "Premier League. One hundred credits. Your squad.",
    type: "website",
    images: [{ url: "/og-fantasy-sv-logo.png", width: 1200, height: 630, alt: "Logo Fantasy SV" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fantasy SV",
    description: "Premier League. One hundred credits. Your squad.",
    images: ["/og-fantasy-sv-logo.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
