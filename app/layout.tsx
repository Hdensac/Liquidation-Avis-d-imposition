import type { Metadata } from "next";
import "./globals.css";
import AuthSync from "@/components/AuthSync";
import SentryInitializer from "@/components/SentryInitializer";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title: "Liquidation - (TFU & TPS)",
  description:
    "Application d'automatisation de la création de fiche de liquidation d'impôt foncier TFU/FNB et TPS avec export PDF et Excel.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" type="image/png" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="antialiased">
        <SentryInitializer />
        <AuthSync />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

