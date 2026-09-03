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
      { url: "/logo.png", type: "image/png" },
      { url: "/favicon.ico", type: "image/x-icon" }
    ],
    shortcut: "/logo.png",
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
        <link rel="icon" type="image/png" href="/logo.png" />
        <link rel="shortcut icon" href="/logo.png" />
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

